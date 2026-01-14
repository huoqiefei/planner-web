import { User } from '../types';
import { useTranslation } from '../utils/i18n';

export const usePermissions = (
    user: User | null,
    lang: 'en' | 'zh',
    setModalData: (data: any) => void,
    setActiveModal: (modal: string | null) => void
) => {
    const { t } = useTranslation(lang);

    /**
     * 获取有效的授权类型（基于在线订阅）
     */
    const getEffectiveRole = (): string => {
        return user?.plannerRole || 'trial';
    };

    /**
     * 获取功能限制（基于在线订阅计划）
     */
    const getFeatureLimits = () => {
        const role = user?.plannerRole || 'trial';
        const limits: Record<string, any> = {
            trial: { 
                maxActivities: 20, 
                maxResources: 10, 
                maxProjects: 1, 
                enableExport: false, 
                enablePrint: true, 
                enableCloud: false, 
                watermark: true 
            },
            licensed: { 
                maxActivities: 100, 
                maxResources: 50, 
                maxProjects: 10, 
                enableExport: true, 
                enablePrint: true, 
                enableCloud: true, 
                watermark: false 
            },
            premium: { 
                maxActivities: 500, 
                maxResources: 200, 
                maxProjects: 50, 
                enableExport: true, 
                enablePrint: true, 
                enableCloud: true, 
                watermark: false 
            },
            admin: { 
                maxActivities: 9999, 
                maxResources: 9999, 
                maxProjects: 9999, 
                enableExport: true, 
                enablePrint: true, 
                enableCloud: true, 
                watermark: false 
            }
        };
        return limits[role] || limits.trial;
    };

    /**
     * 检查是否需要显示水印
     */
    const shouldShowWatermark = (): boolean => {
        const limits = getFeatureLimits();
        return limits.watermark === true;
    };

    const checkPermission = (action: string): boolean => {
        const effectiveRole = getEffectiveRole();
        const group = user?.group || 'viewer';
        const limits = getFeatureLimits();

        // ADMIN OVERRIDE: Admin group always has permission
        if (group === 'admin' || effectiveRole === 'admin') {
            return true;
        }

        // 1. Group-based Access Control (Viewer Restrictions)
        if (group === 'viewer') {
            const viewerDenied = ['new_project', 'export', 'cloud_save', 'project_info', 'admin', 'cut', 'paste', 'delete'];
            if (viewerDenied.includes(action)) {
                setModalData({
                    msg: t('AccessDeniedMsg') || "Access Denied. Read-only access.",
                    title: t('AccessDenied') || "Access Denied"
                });
                setActiveModal('alert');
                return false;
            }
        }

        // 2. Feature-based Access Control (基于 License 功能)
        if (action === 'export' && !limits.enableExport) {
            setModalData({
                msg: lang === 'zh' ? '导出功能需要升级授权' : 'Export feature requires license upgrade',
                title: t('AccessDenied') || "Access Denied"
            });
            setActiveModal('alert');
            return false;
        }

        if (action === 'print' && !limits.enablePrint) {
            setModalData({
                msg: lang === 'zh' ? '打印功能需要升级授权' : 'Print feature requires license upgrade',
                title: t('AccessDenied') || "Access Denied"
            });
            setActiveModal('alert');
            return false;
        }

        if ((action === 'cloud_save' || action === 'cloud_load') && !limits.enableCloud) {
            setModalData({
                msg: lang === 'zh' ? '云存储功能需要升级授权' : 'Cloud storage requires license upgrade',
                title: t('AccessDenied') || "Access Denied"
            });
            setActiveModal('alert');
            return false;
        }

        // 3. Role-based restrictions
        const restrictions: Record<string, string[]> = {
            'admin': ['admin'],
        };

        if (restrictions[action] && !restrictions[action].includes(effectiveRole)) {
            setModalData({
                msg: t('AccessDeniedMsg') || "Access Denied. Please upgrade your subscription plan.",
                title: t('AccessDenied') || "Access Denied"
            });
            setActiveModal('alert');
            return false;
        }

        return true;
    };

    return { 
        checkPermission, 
        getEffectiveRole, 
        getFeatureLimits, 
        shouldShowWatermark 
    };
};
