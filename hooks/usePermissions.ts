import { User } from '../types';
import { useTranslation } from '../utils/i18n';

export const usePermissions = (
    user: User | null, 
    lang: 'en' | 'zh',
    setModalData: (data: any) => void, 
    setActiveModal: (modal: string | null) => void
) => {
    const { t } = useTranslation(lang);

    const checkPermission = (action: string): boolean => {
        const role = user?.plannerRole || 'trial';
        const group = user?.group || 'viewer';
        
        // ADMIN OVERRIDE: Admin group always has permission
        if (group === 'admin' || role === 'admin') {
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

        // 2. Subscription-based Access Control (Planner Role)
        const restrictions: Record<string, string[]> = {
            'admin': ['admin'],
            'print': ['licensed', 'premium', 'admin'],
            // 'export': ['licensed', 'premium', 'admin'], // JSON Export allowed for all
            // 'cloud_save': Allowed for all (Backend enforces limits)
            // 'cloud_load': Allowed for all
        };

        if (restrictions[action] && !restrictions[action].includes(role)) {
            setModalData({ 
                msg: t('AccessDeniedMsg') || "Access Denied. Please upgrade your plan.", 
                title: t('AccessDenied') || "Access Denied" 
            });
            setActiveModal('alert');
            return false;
        }
        
        return true;
    };

    return { checkPermission };
};
