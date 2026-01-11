import { FilterCondition } from '../types';

export const matchFilter = (item: any, conditions: FilterCondition[]): boolean => {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(cond => {
        let val = item[cond.field];
        // Handle nested properties if needed? For now straightforward access.
        // Special case: Custom Fields access
        if (cond.field.startsWith('cf_')) {
            const cfId = cond.field.substring(3);
            val = item.customFields?.[cfId];
        }

        return checkCondition(val, cond);
    });
};

const checkCondition = (val: any, cond: FilterCondition): boolean => {
    const { operator, value } = cond;

    // Handle null/undefined
    if (val === null || val === undefined) {
        if (operator === 'neq' && value) return true;
        // Logic for empty checks?
        return false;
    }

    // Convert value based on type if needed, but we assume UI passes correct type or match logic handles it.
    // However, Activity properties like 'start'/'finish' are Dates.

    let compareVal = val;
    let targetVal = value;

    if (val instanceof Date) {
        // Simple date compare (string or day?)
        // If filter value is string YYYY-MM-DD
        if (typeof targetVal === 'string') {
            const dStr = val.toISOString().split('T')[0];
            compareVal = dStr;
        }
    } else if (typeof val === 'number') {
        targetVal = Number(targetVal); // Ensure number compare
    } else {
        compareVal = String(val).toLowerCase();
        if (typeof targetVal === 'string') targetVal = targetVal.toLowerCase();
    }

    switch (operator) {
        case 'contains':
            return String(compareVal).includes(String(targetVal));
        case 'equals':
            // Loose equality for cross-type (string vs number from input)
            // But we transformed above.
            return compareVal == targetVal;
        case 'neq':
            return compareVal != targetVal;
        case 'gt':
            return compareVal > targetVal;
        case 'lt':
            return compareVal < targetVal;
        case 'gte':
            return compareVal >= targetVal;
        case 'lte':
            return compareVal <= targetVal;
        default:
            return true;
    }
};
