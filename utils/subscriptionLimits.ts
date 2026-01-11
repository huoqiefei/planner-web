// Subscription limits configuration utility
// Reads from environment variables for dynamic updates

export interface SubscriptionLimits {
    activities: number;
    resources: number;
    customFields: number;
    cloudProjects?: number;
}

export type SubscriptionRole = 'trial' | 'licensed' | 'premium' | 'admin';

/**
 * Get subscription limits for a given role
 * Reads from environment variables to allow dynamic configuration
 */
export function getSubscriptionLimits(role: SubscriptionRole): SubscriptionLimits {
    const limitMaps = {
        trial: {
            activities: Number(import.meta.env.VITE_LIMIT_TRIAL) || 20,
            resources: Number(import.meta.env.VITE_LIMIT_RESOURCE_TRIAL) || 10,
            customFields: Number(import.meta.env.VITE_LIMIT_CUSTOM_FIELD_TRIAL) || 5,
            cloudProjects: Number(import.meta.env.VITE_LIMIT_CLOUD_TRIAL) || 3,
        },
        licensed: {
            activities: Number(import.meta.env.VITE_LIMIT_LICENSED) || 100,
            resources: Number(import.meta.env.VITE_LIMIT_RESOURCE_LICENSED) || 50,
            customFields: Number(import.meta.env.VITE_LIMIT_CUSTOM_FIELD_LICENSED) || 20,
            cloudProjects: Number(import.meta.env.VITE_LIMIT_CLOUD_LICENSED) || 10,
        },
        premium: {
            activities: Number(import.meta.env.VITE_LIMIT_PREMIUM) || 500,
            resources: Number(import.meta.env.VITE_LIMIT_RESOURCE_PREMIUM) || 200,
            customFields: Number(import.meta.env.VITE_LIMIT_CUSTOM_FIELD_PREMIUM) || 50,
            cloudProjects: Number(import.meta.env.VITE_LIMIT_CLOUD_PREMIUM) || 50,
        },
        admin: {
            activities: Number(import.meta.env.VITE_LIMIT_ADMIN) || 9999,
            resources: Number(import.meta.env.VITE_LIMIT_RESOURCE_ADMIN) || 9999,
            customFields: Number(import.meta.env.VITE_LIMIT_CUSTOM_FIELD_ADMIN) || 9999,
            cloudProjects: Number(import.meta.env.VITE_LIMIT_CLOUD_ADMIN) || 9999,
        },
    };

    return limitMaps[role] || limitMaps.trial;
}

/**
 * Check if a value exceeds the limit for a given role
 */
export function isOverLimit(value: number, limit: number): boolean {
    return limit <= 9000 && value >= limit;
}

/**
 * Format limit display (show ∞ for admin limits)
 */
export function formatLimit(limit: number): string {
    return limit > 9000 ? '∞' : limit.toString();
}
