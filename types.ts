
export interface Resource {
  id: string;
  name: string;
  type: 'Labor' | 'Material' | 'Equipment';
  unit: string; // e.g., "hr", "m3", "ea"
  maxUnits: number; // Max units per time (e.g. 8/day)
}

export interface Assignment {
  activityId: string;
  resourceId: string;
  units: number; // Stored as TOTAL units internally. UI handles conversion based on type.
}

export type ActivityType = 'Task' | 'Start Milestone' | 'Finish Milestone';

export type RelationType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Predecessor {
    activityId: string;
    type: RelationType;
    lag: number; 
}

export interface CalendarException {
    date: string; // YYYY-MM-DD
    isWorking: boolean;
}

export interface Calendar {
    id: string;
    name: string;
    isDefault: boolean;
    weekDays: boolean[]; // 0=Sun, 1=Mon... true=working
    hoursPerDay: number;
    exceptions: CalendarException[];
}

export interface Activity {
  id: string;
  name: string;
  wbsId: string;
  activityType: ActivityType;
  duration: number;
  calendarId?: string;
  startDate: Date;
  endDate: Date;
  predecessors: Predecessor[];
  isCritical?: boolean;
  earlyStart: Date;
  earlyFinish: Date;
  lateStart: Date;
  lateFinish: Date;
  totalFloat: number;
  budgetedCost: number;
}

export interface WBSNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ProjectMeta {
  title: string;
  projectCode: string;
  projectStartDate: string; // YYYY-MM-DD
  defaultCalendarId: string;
  activityIdPrefix: string;
  activityIdIncrement: number;
  resourceIdPrefix: string;
  resourceIdIncrement: number;
}

export interface ProjectData {
    meta: ProjectMeta;
    wbs: WBSNode[];
    activities: Activity[];
    resources: Resource[];
    assignments: Assignment[];
    calendars: Calendar[];
}

export interface ScheduleResult {
    activities: Activity[];
    wbsMap: Record<string, { startDate: Date; endDate: Date; duration: number }>;
}

export interface GridSettings {
    showVertical: boolean;
    showHorizontal: boolean;
    showWBSLines: boolean;
    verticalInterval?: 'auto' | 'month' | 'quarter' | 'year';
}

export type UISize = 'small' | 'medium' | 'large';

export interface UserSettings {
    dateFormat: 'YYYY-MM-DD' | 'DD-MMM-YYYY' | 'MM/DD/YYYY';
    language: 'en' | 'zh';
    uiSize: UISize;
    uiFontPx?: number;
    gridSettings: GridSettings;
    visibleColumns: string[]; // Added
}

export interface PrintSettings {
    paperSize: 'a4' | 'a3' | 'a2' | 'a1';
    orientation: 'landscape' | 'portrait';
    scalingMode: 'fit' | 'custom'; // Added
    scalePercent: number; // Added (100 = 1.0)
    headerText?: string;
    footerText?: string;
    showPageNumber: boolean;
    showDate: boolean;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
    uid: string;
    name: string;
    mail: string;
    group: UserRole; // Mapped from Typecho group
    token?: string;
}

export interface AdminConfig {
    appName: string;
    copyrightText: string;
    enableWatermark: boolean;
    watermarkText?: string;
    watermarkFontSize?: number;
    watermarkOpacity?: number; // 0.1 to 1.0
    watermarkImage?: string; // Base64 string
    appLogo?: string; // Base64 string for Landing Page & default Watermark
    ganttBarRatio: number; // 0.1 to 0.8
}

export type AIProvider = 'google' | 'openai' | 'deepseek';

export interface AISettings {
    provider: AIProvider;
    apiKey: string;
    model: string;
    baseUrl?: string;
}
