import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ProjectData, ScheduleResult, UserSettings, PrintSettings, AdminConfig, User } from '../types';

interface UsePrintProps {
    data: ProjectData | null;
    schedule: ScheduleResult;
    view: 'activities' | 'resources';
    setView: (view: 'activities' | 'resources') => void;
    user: User | null;
    adminConfig: AdminConfig;
    userSettings: UserSettings;
    ganttZoom: 'day' | 'week' | 'month' | 'quarter' | 'year';
    setActiveModal: (modal: string | null) => void;
    setModalData: (data: any) => void;
}

export const usePrint = ({
    data,
    schedule,
    view,
    setView,
    user,
    adminConfig,
    userSettings,
    ganttZoom,
    setActiveModal,
    setModalData
}: UsePrintProps) => {

    const executePrint = React.useCallback(async (settings: PrintSettings) => {
        if (view !== 'activities') setView('activities');
        await new Promise(r => setTimeout(r, 200));

        // Permission Check for Watermark
        const role = user?.plannerRole || 'trial';
        // Follower (Trial): Watermark
        // Contributor (Licensed) / Editor (Premium): No Watermark
        let enableWatermark = adminConfig.enableWatermark;
        if (role === 'trial') enableWatermark = true;
        else if (['licensed', 'premium', 'admin'].includes(role)) enableWatermark = false;

        const original = document.querySelector('.combined-view-container');
        if (!original) {
            setModalData({ msg: "Could not find view to print.", title: "Print Error" });
            setActiveModal('alert');
            return;
        }

        // 1. Setup Staging Area (Clone)
        const clone = original.cloneNode(true) as HTMLElement;
        document.body.appendChild(clone);
        
        // Style Clone for Capture
        clone.style.position = 'absolute';
        clone.style.top = '-10000px';
        clone.style.left = '-10000px';
        clone.style.height = 'auto'; 
        clone.style.width = 'fit-content';
        clone.style.overflow = 'visible';
        clone.style.backgroundColor = 'white';
        clone.style.border = 'none'; 
        clone.style.padding = '0';

        // 2. Strict Column Hiding & Width Calc
        const allowedCols = userSettings.visibleColumns;
        const headerCells = clone.querySelectorAll('.p6-header > div');
        let tableWidth = 0;
        
        const isColVisible = (el: Element) => {
            const colId = el.getAttribute('data-col');
            return colId && (allowedCols.includes(colId) || colId === 'index');
        };

        headerCells.forEach((cell: any) => {
            if(isColVisible(cell)) {
                // Force explicit width for index column if needed, though style.width should catch it
                const w = parseFloat(cell.style.width || '0');
                if(w>0) tableWidth += w;
                
                // Print styling for header cells
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                if(cell.getAttribute('data-col') === 'index') {
                    cell.style.backgroundColor = '#f1f5f9'; // bg-slate-100
                    cell.style.color = '#64748b'; // text-slate-500
                }
            } else {
                cell.style.display = 'none';
            }
        });

        const cells = clone.querySelectorAll('.p6-cell');
        cells.forEach((cell: any) => {
            if(!isColVisible(cell)) cell.style.display = 'none';
            else {
                // Formatting for print - FORCE VISIBILITY AND ALIGNMENT
                cell.style.display = 'flex'; 
                cell.style.alignItems = 'center'; 
                cell.style.overflow = 'visible'; 
                cell.style.padding = '0 4px'; // Horizontal padding only
                
                // FORCE BORDER VISIBILITY
                cell.style.borderRight = '1px solid #94a3b8'; // Darker color for print visibility
                cell.style.height = 'auto'; // Allow stretch
                cell.style.boxSizing = 'border-box';

                // Fix nested div alignment (especially for ID column with indentation)
                const innerDivs = cell.querySelectorAll('div');
                innerDivs.forEach((d: HTMLElement) => {
                    d.style.display = 'flex';
                    d.style.alignItems = 'center';
                    d.style.height = 'auto';
                    d.style.minHeight = '100%';
                });

                // CRITICAL FIX: Target ALL spans to fix ID text clipping
                // (ID cell has multiple spans: one for icon, one for text)
                const spans = cell.querySelectorAll('span');
                spans.forEach((span: any) => {
                    span.style.textOverflow = 'clip'; 
                    span.style.overflow = 'visible'; 
                    span.style.whiteSpace = 'nowrap';
                    span.style.lineHeight = '1.2'; // Tight line height
                    span.style.height = 'auto'; 
                    span.style.maxHeight = 'none'; // Ensure no max-height constraints
                    span.style.display = 'inline-block'; // Ensure proper height calculation
                    span.style.verticalAlign = 'middle';
                });
            }
        });

        // Resize Table Container
        const tableWrapper = clone.querySelector('.border-r.flex-col') as HTMLElement; 
        if(tableWrapper) {
            tableWrapper.style.width = `${tableWidth}px`;
            tableWrapper.style.minWidth = `${tableWidth}px`;
            tableWrapper.style.flexShrink = '0';
        }

        // --- FIX START: DYNAMIC GANTT WIDTH & CLIP ---
        const zoomMap: Record<string, number> = {
            day: 40, week: 15, month: 5, quarter: 2, year: 0.5
        };
        const px = zoomMap[ganttZoom] || 40;

        // Calculate Project Date Range from Schedule for Exact Width
        let maxEnd = new Date(data!.meta.projectStartDate).getTime();
        let minStart = new Date(data!.meta.projectStartDate).getTime();

        if (schedule.activities.length > 0) {
            schedule.activities.forEach(a => {
                // const startT = a.startDate.getTime(); // Removed to enforce Project Start Date anchor
                const endT = a.endDate.getTime();
                if (endT > maxEnd) maxEnd = endT;
                // if (startT < minStart) minStart = startT; // FIX: Strict adherence to Project Start Date unless custom range
            });
        }

        // Apply Custom Print Range if Provided
        let printStart = minStart;
        let printEnd = maxEnd;
        let shiftPx = 0;

        if (settings.startDate && settings.endDate) {
            const ps = new Date(settings.startDate).getTime();
            const pe = new Date(settings.endDate).getTime();
            if (!isNaN(ps) && !isNaN(pe) && pe > ps) {
                printStart = ps;
                printEnd = pe;
                
                // Calculate shift (how much to move left)
                // The Gantt starts at projectStartDate
                // If printStart > projectStartDate, we need to shift LEFT (negative margin)
                // If printStart < projectStartDate, we need to shift RIGHT (positive margin) - but usually project starts earlier
                
                // Current visual start is at getPosition(projectStartDate) which is 0 (plus buffer)
                // getPosition(date) = (date - projectStartDate) * px
                const projectStart = new Date(data!.meta.projectStartDate).getTime();
                shiftPx = (printStart - projectStart) / (1000 * 60 * 60 * 24) * px;
            }
        }
        
        // Calculate strict duration for Width
        const diffDays = Math.max(1, (printEnd - printStart) / (1000 * 60 * 60 * 24));
        const ganttContentWidth = (diffDays + 2) * px; // +2 days buffer

        // Force Gantt Width - Strict Clipping
        const ganttSvg = clone.querySelector('svg');
        let ganttWidth = ganttContentWidth;
        
        if(ganttSvg) {
            // Apply widths to all SVGs and Containers in the Gantt section
            const allSvgs = clone.querySelectorAll('svg');
            allSvgs.forEach((svg: any) => {
                svg.setAttribute('width', `${ganttWidth}`);
            });

            const ganttWrappers = clone.querySelectorAll('.gantt-component, .gantt-header-wrapper, .gantt-body-wrapper');
            ganttWrappers.forEach((el: any) => {
                el.style.width = `${ganttWidth}px`;
                el.style.minWidth = `${ganttWidth}px`;
                el.style.overflow = 'hidden'; // Force clip for print
                
                // Apply Shift if needed (Clip the left part)
                if (shiftPx !== 0) {
                    // We need to shift the CONTENT inside the wrapper
                    // The content is likely the SVG or a div inside
                    // If we set scrollLeft, it might not print
                    // Better to set margin-left on the first child
                    if (el.firstChild) {
                        (el.firstChild as HTMLElement).style.marginLeft = `-${shiftPx}px`;
                    }
                }
            });
        }
        // --- FIX END ---

        // 3. SEPARATE HEADERS FROM BODY
        const tableHeader = clone.querySelector('.p6-header') as HTMLElement;
        const tableBody = clone.querySelector('.p6-table-body') as HTMLElement;
        
        const ganttHeader = clone.querySelector('.gantt-header-wrapper') as HTMLElement;
        const ganttBody = clone.querySelector('.gantt-body-wrapper') as HTMLElement;

        if (!tableHeader || !tableBody || !ganttHeader || !ganttBody) {
            document.body.removeChild(clone);
            setModalData({ msg: "Print Error: Could not parse view structure. Please try again.", title: "Print Error" });
            setActiveModal('alert');
            return;
        }

        // Create Header Assembly
        const headerAssembly = document.createElement('div');
        headerAssembly.style.display = 'flex';
        headerAssembly.style.width = `${tableWidth + ganttWidth}px`;
        headerAssembly.style.backgroundColor = 'white';
        headerAssembly.style.borderBottom = '1px solid #cbd5e1';
        
        tableHeader.style.width = `${tableWidth}px`;
        tableHeader.style.minWidth = `${tableWidth}px`; // FIX: Explicitly set min-width to match width to override CSS class
        tableHeader.style.maxWidth = `${tableWidth}px`; // FIX: Explicitly set max-width
        tableHeader.style.flex = '0 0 auto'; // FIX: Prevent flex grow/shrink
        tableHeader.style.padding = '0'; // FIX: Remove any padding
        tableHeader.style.margin = '0'; // FIX: Remove any margin
        tableHeader.style.boxSizing = 'border-box'; // FIX: Ensure border is included in width
        tableHeader.style.overflow = 'hidden'; // FIX: Hide any potential overflow
        headerAssembly.appendChild(tableHeader);
        
        ganttHeader.style.width = `${ganttWidth}px`;
        ganttHeader.style.minWidth = `${ganttWidth}px`; // FIX: Explicitly set min-width
        ganttHeader.style.maxWidth = `${ganttWidth}px`; // FIX: Explicitly set max-width
        ganttHeader.style.border = 'none'; 
        ganttHeader.style.flex = '0 0 auto';
        ganttHeader.style.padding = '0';
        ganttHeader.style.margin = '0';
        ganttHeader.style.boxSizing = 'border-box';
        ganttHeader.style.overflow = 'hidden';
        headerAssembly.appendChild(ganttHeader);

        // Create Body Assembly
        const bodyAssembly = document.createElement('div');
        bodyAssembly.style.display = 'flex';
        bodyAssembly.style.width = `${tableWidth + ganttWidth}px`;
        bodyAssembly.style.backgroundColor = 'white';
        
        tableBody.style.width = `${tableWidth}px`;
        tableBody.style.height = 'auto';
        tableBody.style.overflow = 'visible';
        tableBody.style.flexShrink = '0';
        
        // FIX: Ensure inner content of tableBody doesn't overflow
        const tableBodyInner = tableBody.firstElementChild as HTMLElement;
        if (tableBodyInner) {
            tableBodyInner.style.width = '100%';
            tableBodyInner.style.minWidth = '0'; // Override any existing min-width
            tableBodyInner.style.overflow = 'visible';
        }

        bodyAssembly.appendChild(tableBody);

        ganttBody.style.width = `${ganttWidth}px`;
        ganttBody.style.height = 'auto';
        ganttBody.style.overflow = 'visible';
        bodyAssembly.appendChild(ganttBody);

        // 4. Row Alignment (Remove max-height limits)
        const tableRows = tableBody.querySelectorAll('.p6-row');
        tableRows.forEach((row: any) => {
            const h = row.style.height; 
            if(h) {
                row.style.minHeight = h;
                row.style.height = 'auto'; // FIX: Remove strict height match to allow font flex
                row.style.overflow = 'visible'; // ALLOW content to show if slightly larger
                row.style.maxHeight = 'none'; // Ensure no max height constraint
                
                // PRINT FIX: Ensure cells stretch to full row height for continuous vertical lines
                row.style.display = 'flex';
                row.style.alignItems = 'stretch'; 
                row.style.borderBottom = '1px solid #cbd5e1';
            }
        });

        // 5. Append Assemblies
        const staging = document.createElement('div');
        staging.style.position = 'absolute';
        staging.style.top = '-10000px';
        staging.style.left = '-10000px';
        staging.style.backgroundColor = 'white';
        staging.appendChild(headerAssembly);
        staging.appendChild(bodyAssembly);
        document.body.appendChild(staging);

        // 5.5 Create Custom Header Assembly for Capture (Fixing Chinese Font Issue)
        let customHeaderCanvas: HTMLCanvasElement | null = null;
        if (settings.headerText) {
            const hDiv = document.createElement('div');
            hDiv.innerText = settings.headerText;
            hDiv.style.fontSize = '24px'; // High res for print
            hDiv.style.fontWeight = 'bold';
            hDiv.style.color = '#334155';
            hDiv.style.textAlign = 'center';
            hDiv.style.width = `${tableWidth + ganttWidth}px`; 
            hDiv.style.backgroundColor = 'white';
            hDiv.style.padding = '20px'; // Padding
            staging.appendChild(hDiv);
            try {
                customHeaderCanvas = await html2canvas(hDiv, { scale: 2, logging: false });
            } catch(e) { console.error("Header capture failed", e); }
            staging.removeChild(hDiv); // Clean up immediately from staging
        }

        // 6. Capture
        try {
            // Increase scale to 3 for higher clarity on large prints
            const headerCanvas = await html2canvas(headerAssembly, { scale: 3, logging: false });
            const bodyCanvas = await html2canvas(bodyAssembly, { scale: 3, logging: false });
            
            document.body.removeChild(clone);
            document.body.removeChild(staging);

            // 7. Generate PDF
            const dims: Record<string, {w: number, h: number}> = { 'a4': {w: 595, h: 842}, 'a3': {w: 842, h: 1190}, 'a2': {w: 1190, h: 1684}, 'a1': {w: 1684, h: 2384} };
            const isLandscape = settings.orientation === 'landscape';
            const pageW = isLandscape ? dims[settings.paperSize].h : dims[settings.paperSize].w;
            const pageH = isLandscape ? dims[settings.paperSize].w : dims[settings.paperSize].h;
            
            const margin = 20;
            
            // Calculate Header/Footer Heights
            const customHeaderH = customHeaderCanvas ? 60 : (settings.headerText ? 30 : 0);
            const customFooterH = (settings.footerText || settings.showPageNumber || settings.showDate) ? 30 : 0;

            const contentW = pageW - (margin * 2);
            const contentH = pageH - (margin * 2) - customHeaderH - customFooterH;

            const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'pt', [pageW, pageH]);

            const totalImgW = headerCanvas.width;
            
            // --- SCALING LOGIC ---
            // Base Ratio: Fits width to page content
            // Note: totalImgW is at 3x scale (from html2canvas)
            const fitRatio = contentW / totalImgW;
            
            // Fix overly large scaling for small content: Cap at 100% size (1/3 of 3x capture)
            const maxAuto = 1/3;
            const autoScale = Math.min(fitRatio, maxAuto);

            const scaleFactor = settings.scalingMode === 'custom' 
                ? (1/3) * (settings.scalePercent / 100) 
                : autoScale;

            const headerH = headerCanvas.height * scaleFactor;
            const bodyTotalH = bodyCanvas.height * scaleFactor;
            
            let yOffset = 0; 
            let heightLeft = bodyTotalH;

            // PREPARE WATERMARK
            let wmDataUrl = '';
            if (enableWatermark) {
                const wmCanvas = document.createElement('canvas');
                wmCanvas.width = pageW;
                wmCanvas.height = pageH;
                const ctx = wmCanvas.getContext('2d');
                if (ctx) {
                    ctx.save();
                    ctx.translate(pageW/2, pageH/2);
                    ctx.rotate(-30 * Math.PI / 180);
                    ctx.translate(-pageW/2, -pageH/2);
                    
                    ctx.globalAlpha = adminConfig.watermarkOpacity || 0.2;
                    
                    const imgSource = adminConfig.watermarkImage || adminConfig.appLogo;

                    if (imgSource) {
                        const img = new Image();
                        img.src = imgSource;
                        await new Promise(r => img.onload = r);
                        const aspect = img.width / img.height;
                        const drawW = Math.min(400, img.width);
                        const drawH = drawW / aspect;
                        ctx.drawImage(img, (pageW - drawW)/2, (pageH - drawH)/2, drawW, drawH);
                    }
                    
                    if (adminConfig.watermarkText || (!imgSource && adminConfig.copyrightText)) {
                        const text = adminConfig.watermarkText || adminConfig.appName;
                        ctx.font = `bold ${adminConfig.watermarkFontSize || 40}px Arial`;
                        ctx.fillStyle = '#94a3b8';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const textY = imgSource ? (pageH/2 + 150) : pageH/2;
                        ctx.fillText(text, pageW/2, textY);
                    }
                    ctx.restore();
                    wmDataUrl = wmCanvas.toDataURL('image/png');
                }
            }

            // PAGINATION LOOP
            while (heightLeft > 0) {
                // Custom Header Text
                if (customHeaderCanvas) {
                    const aspect = customHeaderCanvas.width / customHeaderCanvas.height;
                    const drawH = 40; // Fixed height for header
                    const drawW = drawH * aspect;
                    const x = (pageW - drawW) / 2; // Center
                    pdf.addImage(customHeaderCanvas.toDataURL('image/png'), 'PNG', x, margin, drawW, drawH);
                } else if (settings.headerText) {
                    pdf.setFontSize(14);
                    pdf.setTextColor(50);
                    pdf.text(settings.headerText, pageW / 2, margin + 15, { align: 'center' });
                }

                const tableHeaderY = margin + customHeaderH;

                // Table Header Image
                pdf.addImage(headerCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', margin, tableHeaderY, headerCanvas.width * scaleFactor, headerH);
                
                // Draw a box around header region (clamped to page)
                const headerBoxW = Math.min(contentW, headerCanvas.width * scaleFactor);
                pdf.setDrawColor(203, 213, 225); 
                pdf.rect(margin, tableHeaderY, headerBoxW, headerH);

                // Body Slice
                const availableH = contentH - headerH - 10;
                const sliceH = Math.min(heightLeft, availableH);
                
                const sourceY = yOffset / scaleFactor;
                const sourceH = sliceH / scaleFactor;

                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = bodyCanvas.width;
                // Safety check for tiny sourceH
                if (sourceH > 0) {
                    sliceCanvas.height = sourceH;
                    const sCtx = sliceCanvas.getContext('2d');
                    if (sCtx) {
                        sCtx.drawImage(
                            bodyCanvas, 
                            0, sourceY, bodyCanvas.width, sourceH, 
                            0, 0, sliceCanvas.width, sliceCanvas.height 
                        );
                        
                        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', margin, tableHeaderY + headerH, sliceCanvas.width * scaleFactor, sliceH);
                        
                        const bodyBoxW = Math.min(contentW, sliceCanvas.width * scaleFactor);
                        pdf.rect(margin, tableHeaderY + headerH, bodyBoxW, sliceH);
                    }
                }

                // Watermark (Draw AFTER content to be on top)
                if (wmDataUrl) {
                    pdf.addImage(wmDataUrl, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
                }

                // Custom Footer
                const footerY = pageH - margin - 10;
                pdf.setFontSize(10);
                pdf.setTextColor(100);
                
                if (settings.footerText) {
                    pdf.text(settings.footerText, pageW / 2, footerY, { align: 'center' });
                }

                if (settings.showPageNumber) {
                    const pageNum = pdf.getNumberOfPages();
                    // const text = settings.footerText ? `- ${pageNum} -` : `- ${pageNum} -`;
                    // const x = settings.footerText ? pageW - margin - 20 : pageW / 2;
                    // If center is taken by footerText, move page number to right
                    if (settings.footerText) pdf.text(`Page ${pageNum}`, pageW - margin, footerY, { align: 'right' });
                    else pdf.text(`- ${pageNum} -`, pageW / 2, footerY, { align: 'center' });
                }
                
                if (settings.showDate) {
                     const dateStr = new Date().toLocaleDateString();
                     pdf.text(dateStr, margin, footerY);
                }

                heightLeft -= sliceH;
                yOffset += sliceH;

                if (heightLeft > 0) pdf.addPage();
            }

            window.open(pdf.output('bloburl'), '_blank');

        } catch (e) {
            console.error("Print Error", e);
            setModalData({ msg: "Print generation failed. Please try again.", title: "Error" });
            setActiveModal('alert');
            if(document.body.contains(clone)) document.body.removeChild(clone);
            if(document.body.contains(staging)) document.body.removeChild(staging);
        }
    }, [view, setView, user, adminConfig, setModalData, setActiveModal, userSettings.visibleColumns, ganttZoom, data, schedule.activities]);

    return { executePrint };
};