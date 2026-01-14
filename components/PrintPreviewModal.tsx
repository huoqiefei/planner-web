import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useTranslation } from '../utils/i18n';
import { useFlatRows } from '../hooks/useFlatRows';
import { usePermissions } from '../hooks/usePermissions';
import CombinedView from './CombinedView';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang?: 'en' | 'zh';
}

const PAPER_SIZES = {
    A4: { width: 210, height: 297, label: 'A4' },
    A3: { width: 297, height: 420, label: 'A3' },
    A2: { width: 420, height: 594, label: 'A2' },
    A1: { width: 594, height: 841, label: 'A1' },
    Letter: { width: 216, height: 279, label: 'Letter' },
    Legal: { width: 216, height: 356, label: 'Legal' },
    Tabloid: { width: 279, height: 432, label: 'Tabloid' },
};

type PaperSize = keyof typeof PAPER_SIZES;
type Orientation = 'portrait' | 'landscape';

const mmToPx = (mm: number) => Math.round(mm * 96 / 25.4);

const HEADER_HEIGHT = 32;
const FOOTER_HEIGHT = 28;
const LEGEND_HEIGHT = 28;
const ROW_HEIGHT = 28;  // 增加行高
const TABLE_HEADER_HEIGHT = 48;  // 增加表头高度以容纳三行时间标尺

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ isOpen, onClose, lang = 'en' }) => {
    const { t } = useTranslation(lang as 'en' | 'zh');
    const { data, showRelations, showCritical, user, adminConfig, setModalData, setActiveModal } = useAppStore();
    const { flatRows } = useFlatRows();
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const pagesRef = useRef<Map<number, HTMLDivElement>>(new Map());

    // 使用 usePermissions 获取水印状态
    const { shouldShowWatermark } = usePermissions(user, lang as 'en' | 'zh', setModalData, setActiveModal);
    const enableWatermark = shouldShowWatermark();
    
    const [settings, setSettings] = useState({
        headerText: '',
        footerText: '',
        showPageNumber: true,
        showDate: true,
        showLegend: true,
        showBorder: true,
        paperSize: 'A3' as PaperSize,
        orientation: 'landscape' as Orientation,
        margins: 10,
        autoPaginate: true,
    });

    const [previewScale, setPreviewScale] = useState(0.7);  // 默认70%缩放
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [previewMode, setPreviewMode] = useState<'single' | 'scroll'>('single'); // 预览模式

    useEffect(() => {
        if (isOpen && data?.meta?.title) {
            setSettings(s => ({ ...s, headerText: data.meta.title }));
        }
        if (isOpen) {
            setCurrentPage(0);
            pagesRef.current.clear();
        }
    }, [isOpen, data?.meta?.title]);

    const paper = PAPER_SIZES[settings.paperSize];
    const paperWidthMm = settings.orientation === 'landscape' ? paper.height : paper.width;
    const paperHeightMm = settings.orientation === 'landscape' ? paper.width : paper.height;
    const paperWidthPx = mmToPx(paperWidthMm);
    const paperHeightPx = mmToPx(paperHeightMm);
    const marginPx = mmToPx(settings.margins);

    const paginationInfo = useMemo(() => {
        const headerFooterHeight = 
            (settings.headerText || settings.showDate ? HEADER_HEIGHT : 0) +
            (settings.footerText || settings.showPageNumber ? FOOTER_HEIGHT : 0) +
            (settings.showLegend ? LEGEND_HEIGHT : 0);
        
        const contentHeight = paperHeightPx - (marginPx * 2) - headerFooterHeight - TABLE_HEADER_HEIGHT - 4;
        const rowsPerPage = Math.max(1, Math.floor(contentHeight / ROW_HEIGHT));
        
        const totalRows = flatRows?.length || 0;
        const totalPages = settings.autoPaginate && totalRows > rowsPerPage 
            ? Math.ceil(totalRows / rowsPerPage) 
            : 1;
        
        const pageRanges: Array<{ start: number; end: number }> = [];
        for (let i = 0; i < totalPages; i++) {
            const start = i * rowsPerPage;
            const end = Math.min(start + rowsPerPage, totalRows);
            pageRanges.push({ start, end });
        }
        
        return { rowsPerPage, totalPages, pageRanges, contentHeight };
    }, [paperHeightPx, marginPx, settings, flatRows?.length]);

    // 重置当前页
    useEffect(() => {
        if (currentPage >= paginationInfo.totalPages) {
            setCurrentPage(Math.max(0, paginationInfo.totalPages - 1));
        }
    }, [paginationInfo.totalPages, currentPage]);

    if (!isOpen || !data) return null;

    const currentDate = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');

    const handleExportPDF = async () => {
        if (isExporting) return;
        setIsExporting(true);
        setExportProgress(0);
        
        const savedCurrentPage = currentPage;
        
        try {
            const pdf = new jsPDF({
                orientation: settings.orientation === 'landscape' ? 'l' : 'p',
                unit: 'mm',
                format: [paperWidthMm, paperHeightMm],
            });
            
            // 逐页导出
            for (let pageIndex = 0; pageIndex < paginationInfo.totalPages; pageIndex++) {
                setExportProgress(Math.round((pageIndex / paginationInfo.totalPages) * 100));
                
                // 切换到当前页
                setCurrentPage(pageIndex);
                
                // 等待React渲染完成
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 获取当前页元素
                const pageElement = pagesRef.current.get(pageIndex);
                if (!pageElement) {
                    console.warn(`Page ${pageIndex} element not found`);
                    continue;
                }
                
                // 临时移除缩放变换，以原始尺寸截图
                const originalTransform = pageElement.style.transform;
                const originalTransformOrigin = pageElement.style.transformOrigin;
                pageElement.style.transform = 'none';
                pageElement.style.transformOrigin = 'top left';
                
                // 等待样式生效
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 以原始尺寸截图
                const canvas = await html2canvas(pageElement, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: paperWidthPx,
                    height: paperHeightPx,
                });
                
                // 恢复缩放
                pageElement.style.transform = originalTransform;
                pageElement.style.transformOrigin = originalTransformOrigin;
                
                // 添加页面到PDF
                if (pageIndex > 0) {
                    pdf.addPage([paperWidthMm, paperHeightMm], settings.orientation === 'landscape' ? 'l' : 'p');
                }
                
                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                pdf.addImage(imgData, 'JPEG', 0, 0, paperWidthMm, paperHeightMm, undefined, 'FAST');
                
                // 添加水印（trial 用户）
                if (enableWatermark) {
                    pdf.setGState(new (pdf as any).GState({ opacity: adminConfig.watermarkOpacity || 0.15 }));
                    pdf.setFontSize(adminConfig.watermarkFontSize || 40);
                    pdf.setTextColor(150, 150, 150);
                    
                    const watermarkText = adminConfig.watermarkText || adminConfig.appName || 'TRIAL';
                    const centerX = paperWidthMm / 2;
                    const centerY = paperHeightMm / 2;
                    
                    // 旋转绘制水印
                    pdf.saveGraphicsState();
                    pdf.text(watermarkText, centerX, centerY, { 
                        align: 'center',
                        angle: 45
                    });
                    pdf.restoreGraphicsState();
                    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
                }
            }
            
            setExportProgress(100);
            
            // 恢复原来的页码
            setCurrentPage(savedCurrentPage);
            
            const fileName = `${settings.headerText || 'schedule'}_${new Date().toISOString().slice(0, 10)}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('PDF export failed:', error);
            setCurrentPage(savedCurrentPage);
            alert(lang === 'zh' ? '导出失败，请重试' : 'Export failed, please try again');
        } finally {
            setIsExporting(false);
            setExportProgress(0);
        }
    };

    const renderPage = (pageIndex: number) => {
        const pageRange = paginationInfo.pageRanges[pageIndex];
        if (!pageRange) return null;
        
        const contentWidth = paperWidthPx - marginPx * 2;
        const showHeader = settings.headerText || settings.showDate;
        const showFooter = settings.footerText || settings.showPageNumber;
        
        return (
            <div 
                key={`page-${pageIndex}`}
                ref={el => { if (el) pagesRef.current.set(pageIndex, el); }}
                className="bg-white shadow-2xl mb-4"
                style={{
                    width: paperWidthPx,
                    height: paperHeightPx,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top center',
                    flexShrink: 0,
                }}
            >
                <div className="flex flex-col h-full" style={{ padding: marginPx }}>
                    <div className={`flex flex-col flex-1 overflow-hidden ${settings.showBorder ? 'border border-slate-400' : ''}`}>
                        {/* 页眉 - SVG */}
                        {showHeader && (
                            <svg width={contentWidth} height={HEADER_HEIGHT} className="shrink-0 border-b border-slate-300" style={{ background: '#f8fafc' }}>
                                <text x={12} y={HEADER_HEIGHT / 2 + 4} fontSize={12} fontWeight={600} fill="#1e293b">{settings.headerText}</text>
                                {settings.showDate && (
                                    <text x={contentWidth - 12} y={HEADER_HEIGHT / 2 + 4} fontSize={11} fill="#64748b" textAnchor="end">{currentDate}</text>
                                )}
                            </svg>
                        )}

                        <div className="flex-1 overflow-hidden">
                            <CombinedView 
                                printMode={true}
                                printPageIndex={pageIndex}
                                printRowStart={pageRange.start}
                                printRowEnd={pageRange.end}
                                printShowRelations={showRelations}
                                printShowCritical={showCritical}
                                printRowHeight={ROW_HEIGHT}
                            />
                        </div>

                        {/* 图例 - SVG */}
                        {settings.showLegend && (
                            <svg width={contentWidth} height={LEGEND_HEIGHT} className="shrink-0 border-t border-slate-300" style={{ background: '#f8fafc' }}>
                                <rect x={12} y={LEGEND_HEIGHT / 2 - 2} width={16} height={5} rx={2} fill="#10b981" />
                                <text x={32} y={LEGEND_HEIGHT / 2 + 4} fontSize={10} fill="#475569">{lang === 'zh' ? '普通' : 'Normal'}</text>
                                
                                {showCritical && (
                                    <>
                                        <rect x={80} y={LEGEND_HEIGHT / 2 - 2} width={16} height={5} rx={2} fill="#ef4444" />
                                        <text x={100} y={LEGEND_HEIGHT / 2 + 4} fontSize={10} fill="#475569">{lang === 'zh' ? '关键' : 'Critical'}</text>
                                    </>
                                )}
                                
                                <rect x={showCritical ? 150 : 80} y={LEGEND_HEIGHT / 2 - 1} width={16} height={3} fill="#94a3b8" />
                                <text x={showCritical ? 170 : 100} y={LEGEND_HEIGHT / 2 + 4} fontSize={10} fill="#475569">WBS</text>
                                
                                {showRelations && (
                                    <>
                                        <line x1={showCritical ? 210 : 140} y1={LEGEND_HEIGHT / 2} x2={showCritical ? 222 : 152} y2={LEGEND_HEIGHT / 2} stroke="#94a3b8" strokeWidth={1} />
                                        <polygon points={showCritical ? "222,11 228,14 222,17" : "152,11 158,14 152,17"} fill="#94a3b8" />
                                        <text x={showCritical ? 232 : 162} y={LEGEND_HEIGHT / 2 + 4} fontSize={10} fill="#475569">{lang === 'zh' ? '逻辑' : 'Link'}</text>
                                    </>
                                )}
                            </svg>
                        )}

                        {/* 页脚 - SVG */}
                        {showFooter && (
                            <svg width={contentWidth} height={FOOTER_HEIGHT} className="shrink-0 border-t border-slate-300" style={{ background: '#f8fafc' }}>
                                <text x={12} y={FOOTER_HEIGHT / 2 + 4} fontSize={10} fill="#64748b">{settings.footerText}</text>
                                {settings.showPageNumber && (
                                    <text x={contentWidth - 12} y={FOOTER_HEIGHT / 2 + 4} fontSize={10} fill="#64748b" textAnchor="end">
                                        {lang === 'zh' ? `第 ${pageIndex + 1} 页 / 共 ${paginationInfo.totalPages} 页` : `Page ${pageIndex + 1} of ${paginationInfo.totalPages}`}
                                    </text>
                                )}
                            </svg>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="print-preview-modal fixed inset-0 z-[100] flex flex-col">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative z-10 flex flex-col h-full m-4 bg-white rounded-lg shadow-2xl max-w-[85vw] max-h-[85vh] mx-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-lg shrink-0">
                    <h2 className="font-bold text-slate-700">{lang === 'zh' ? '打印预览' : 'Print Preview'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50 text-sm shrink-0 flex-wrap">
                    <div className="flex items-center gap-1">
                        <label className="text-slate-600">{lang === 'zh' ? '纸张' : 'Paper'}:</label>
                        <select className="border rounded px-2 py-1 bg-white text-xs" value={settings.paperSize} onChange={e => setSettings({ ...settings, paperSize: e.target.value as PaperSize })}>{Object.entries(PAPER_SIZES).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}</select>
                    </div>
                    <div className="flex items-center gap-1">
                        <label className="text-slate-600">{lang === 'zh' ? '方向' : 'Orient'}:</label>
                        <select className="border rounded px-2 py-1 bg-white text-xs" value={settings.orientation} onChange={e => setSettings({ ...settings, orientation: e.target.value as Orientation })}><option value="portrait">{lang === 'zh' ? '纵向' : 'Portrait'}</option><option value="landscape">{lang === 'zh' ? '横向' : 'Landscape'}</option></select>
                    </div>
                    <div className="flex items-center gap-1">
                        <label className="text-slate-600">{lang === 'zh' ? '边距' : 'Margin'}:</label>
                        <select className="border rounded px-2 py-1 bg-white text-xs" value={settings.margins} onChange={e => setSettings({ ...settings, margins: Number(e.target.value) })}><option value={5}>5mm</option><option value={10}>10mm</option><option value={15}>15mm</option><option value={20}>20mm</option></select>
                    </div>
                    <div className="h-4 border-l border-slate-300" />
                    <input type="text" className="border rounded px-2 py-1 w-24 text-xs" placeholder={lang === 'zh' ? '页眉' : 'Header'} value={settings.headerText} onChange={e => setSettings({ ...settings, headerText: e.target.value })} />
                    <input type="text" className="border rounded px-2 py-1 w-24 text-xs" placeholder={lang === 'zh' ? '页脚' : 'Footer'} value={settings.footerText} onChange={e => setSettings({ ...settings, footerText: e.target.value })} />
                    <div className="h-4 border-l border-slate-300" />
                    <label className="flex items-center gap-1 cursor-pointer text-xs"><input type="checkbox" checked={settings.showPageNumber} onChange={e => setSettings({ ...settings, showPageNumber: e.target.checked })} /><span>{lang === 'zh' ? '页码' : 'Page#'}</span></label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs"><input type="checkbox" checked={settings.showDate} onChange={e => setSettings({ ...settings, showDate: e.target.checked })} /><span>{lang === 'zh' ? '日期' : 'Date'}</span></label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs"><input type="checkbox" checked={settings.showLegend} onChange={e => setSettings({ ...settings, showLegend: e.target.checked })} /><span>{lang === 'zh' ? '图例' : 'Legend'}</span></label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs"><input type="checkbox" checked={settings.showBorder} onChange={e => setSettings({ ...settings, showBorder: e.target.checked })} /><span>{lang === 'zh' ? '边框' : 'Border'}</span></label>
                    <label className="flex items-center gap-1 cursor-pointer text-xs"><input type="checkbox" checked={settings.autoPaginate} onChange={e => setSettings({ ...settings, autoPaginate: e.target.checked })} /><span>{lang === 'zh' ? '分页' : 'Paginate'}</span></label>
                </div>

                {paginationInfo.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2 border-b bg-slate-100 text-sm shrink-0">
                        {/* 预览模式切换 */}
                        <div className="flex items-center gap-1 mr-4">
                            <button 
                                className={`px-2 py-1 rounded text-xs ${previewMode === 'single' ? 'bg-blue-600 text-white' : 'border hover:bg-white'}`}
                                onClick={() => setPreviewMode('single')}
                            >
                                {lang === 'zh' ? '单页' : 'Single'}
                            </button>
                            <button 
                                className={`px-2 py-1 rounded text-xs ${previewMode === 'scroll' ? 'bg-blue-600 text-white' : 'border hover:bg-white'}`}
                                onClick={() => setPreviewMode('scroll')}
                            >
                                {lang === 'zh' ? '滚动' : 'Scroll'}
                            </button>
                        </div>
                        {previewMode === 'single' && (
                            <>
                                <button className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50 text-xs" disabled={currentPage === 0} onClick={() => setCurrentPage(currentPage - 1)}>{lang === 'zh' ? '上一页' : 'Prev'}</button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(paginationInfo.totalPages, 10) }, (_, i) => (
                                        <button key={i} className={`w-7 h-7 rounded text-xs ${currentPage === i ? 'bg-blue-600 text-white' : 'border hover:bg-white'}`} onClick={() => setCurrentPage(i)}>{i + 1}</button>
                                    ))}
                                    {paginationInfo.totalPages > 10 && <span className="text-xs text-slate-500">...</span>}
                                </div>
                                <button className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50 text-xs" disabled={currentPage >= paginationInfo.totalPages - 1} onClick={() => setCurrentPage(currentPage + 1)}>{lang === 'zh' ? '下一页' : 'Next'}</button>
                            </>
                        )}
                        <span className="text-xs text-slate-500 ml-2">{lang === 'zh' ? `共 ${paginationInfo.totalPages} 页` : `${paginationInfo.totalPages} pages`}</span>
                    </div>
                )}

                <div ref={previewContainerRef} className="flex-1 overflow-auto p-4 bg-slate-400 flex flex-col items-center">
                    {/* 预览区域：根据模式显示单页或所有页 */}
                    {previewMode === 'scroll' 
                        ? Array.from({ length: paginationInfo.totalPages }, (_, i) => renderPage(i))
                        : renderPage(currentPage)
                    }
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-100 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs">{lang === 'zh' ? '缩放' : 'Zoom'}:</span>
                        <button className="px-2 py-0.5 border rounded hover:bg-white text-xs" onClick={() => setPreviewScale(s => Math.max(0.2, s - 0.1))}>−</button>
                        <span className="w-12 text-center text-xs">{Math.round(previewScale * 100)}%</span>
                        <button className="px-2 py-0.5 border rounded hover:bg-white text-xs" onClick={() => setPreviewScale(s => Math.min(1.5, s + 0.1))}>+</button>
                    </div>
                    <span className="text-xs text-slate-400">{paperWidthMm}×{paperHeightMm}mm</span>
                </div>

                <div className="flex justify-between items-center gap-2 px-4 py-3 border-t bg-slate-50 rounded-b-lg shrink-0">
                    <p className="text-xs text-slate-500">{lang === 'zh' ? `将导出 ${paginationInfo.totalPages} 页 PDF` : `Export ${paginationInfo.totalPages} page(s) PDF`}</p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100">{t('Cancel')}</button>
                        <button onClick={handleExportPDF} disabled={isExporting} className={`px-4 py-2 rounded text-white ${isExporting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {isExporting ? (lang === 'zh' ? `导出中 ${exportProgress}%` : `Exporting ${exportProgress}%`) : (lang === 'zh' ? '导出 PDF' : 'Export PDF')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPreviewModal;
