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
        const getRoles = (val: string | undefined, defaults: string[]) => {
            return val ? val.split(',').map(s => s.trim()) : defaults;
        };

        const restrictions: Record<string, string[]> = {
            'admin': ['admin'],
            'export': getRoles(import.meta.env.VITE_FEATURE_ROLES_EXPORT, ['licensed', 'premium', 'admin']),
            'print': getRoles(import.meta.env.VITE_FEATURE_ROLES_PRINT, ['trial', 'licensed', 'premium', 'admin']), // Allow print for all, watermarked for trial
            'cloud_save': getRoles(import.meta.env.VITE_FEATURE_ROLES_CLOUD_SAVE, ['trial', 'licensed', 'premium', 'admin']),
            'cloud_load': getRoles(import.meta.env.VITE_FEATURE_ROLES_CLOUD_LOAD, ['trial', 'licensed', 'premium', 'admin']),
        };

        // If action is restricted and user role is not in the allowed list
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
