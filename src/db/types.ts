// TypeScript interfaces for all database entities

// ============================================================================
// Core Entities
// ============================================================================

export interface User {
    id: string; // PK: USER#<cuid>
    sk: string; // SK: METADATA
    firstName: string;
    lastName: string;
    email: string;
    hashedPassword: string;
    roleId: string; // FK: ROLE#<cuid>
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

export interface UserRole {
    id: string; // PK: ROLE#<cuid>
    sk: string; // SK: METADATA
    name: string; // e.g., 'admin', 'support', 'user'
}

export interface Appeal {
    id: string; // PK: APPEAL#<cuid>
    sk: string; // SK: METADATA
    textOfTheAppeal: string;
    createdAt: string;
    confirmationAt?: string;
    updatedAt: string;
    deletedAt?: string;

    // Foreign Keys
    solutionId?: string; // SOLUTION#<cuid>
    appealSubdivisionId: string; // SUBDIVISION#<cuid>
    appealCategoryId: string; // CATEGORY#<cuid>
    appealSoftwareId: string; // SOFTWARE#<cuid>
    appealStatusId: string; // STATUS#<cuid>
    appealCriticalityId: string; // CRITICALITY#<cuid>
}

export interface AppealUser {
    id: string; // Unique ID: APPEALUSER#<cuid>
    appealId: string; // PK: APPEAL#<cuid>
    sk: string; // SK: USER#<userId>#RELATION#<relationId>
    userId: string; // USER#<cuid>
    userMessengerId: string;
    relationId: string; // RELATION#<cuid>
    createdAt: string;
}

export interface Solution {
    id: string; // PK: SOLUTION#<cuid>
    sk: string; // SK: METADATA
    solutionText: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

// ============================================================================
// Reference Tables (Справочники)
// ============================================================================

export interface AppealSubdivision {
    id: string; // PK: SUBDIVISION#<cuid>
    sk: string; // SK: METADATA
    name: string;
}

export interface AppealCategory {
    id: string; // PK: CATEGORY#<cuid>
    sk: string; // SK: METADATA
    name: string;
}

export interface AppealSoftware {
    id: string; // PK: SOFTWARE#<cuid>
    sk: string; // SK: METADATA
    name: string;
}

export interface AppealStatus {
    id: string; // PK: STATUS#<cuid>
    sk: string; // SK: METADATA
    name: string;
}

export interface AppealCriticality {
    id: string; // PK: CRITICALITY#<cuid>
    sk: string; // SK: METADATA
    name: string;
}

export interface UserRelationToAppeal {
    id: string; // PK: RELATION#<cuid>
    sk: string; // SK: METADATA
    name: string; // e.g., 'author', 'assignee', 'observer'
}

// ============================================================================
// Communication Entities
// ============================================================================

export interface Chat {
    id: string; // PK: CHAT#<cuid>
    sk: string; // SK: METADATA
    messengerId: string; // FK: MESSENGER#<cuid>
    chatMessengerId: string; // External ID from messenger
    chatTypeId: string; // FK: CHATTYPE#<cuid>
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

export interface CommunicationWithUser {
    id: string; // PK: COMM#<cuid>
    sk: string; // SK: METADATA
    chatId: string; // FK: CHAT#<cuid>
    userId: string; // FK: USER#<cuid>
    userMessengerId: string;
    email?: string;
    numberPhone?: string;
}

export interface Messenger {
    id: string; // PK: MESSENGER#<cuid>
    sk: string; // SK: METADATA
    name: string; // e.g., 'Telegram', 'WhatsApp', 'Email'
}

export interface ChatType {
    id: string; // PK: CHATTYPE#<cuid>
    sk: string; // SK: METADATA
    name: string; // e.g., 'private', 'group', 'channel'
}

export interface AppealImage {
    id: string; // Unique ID: IMAGE#<cuid>
    appealId: string; // PK: APPEAL#<cuid>
    sk: string; // SK: IMAGE#<cuid>
    fileName: string;
    createdAt: string;
}

export interface UserState {
    id: string; // PK: USER_STATE#<userId>
    sk: string; // SK: METADATA
    userId: string; // Original user ID
    snapshot: any; // XState persisted snapshot (JSON)
    context: Record<string, any>; // Machine context for quick access
    currentState: string; // Current state name (e.g., 'welcome', 'listAppeals')
    machineType: string; // Type of machine ('appealRoot', 'supportAppeal', etc.)
    createdAt: string;
    updatedAt: string;
}

export interface SupportAppealState {
    id: string; // PK: SUPPORT_STATE#<appealId>
    sk: string; // SK: METADATA
    appealId: string; // APPEAL#<cuid>
    snapshot: any; // XState persisted snapshot (JSON)
    context: Record<string, any>; // Machine context for quick access
    currentState: string; // Current state name
    machineType: string; // Type of machine ('supportAppeal', etc.)
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Table Names
// ============================================================================

export const TABLE_NAMES = {
    USERS: 'support_bot_users',
    USER_ROLES: 'support_bot_user_roles',
    APPEALS: 'support_bot_appeals',
    APPEAL_USERS: 'support_bot_appeal_users',
    SOLUTIONS: 'support_bot_solutions',
    APPEAL_SUBDIVISIONS: 'support_bot_appeal_subdivisions',
    APPEAL_CATEGORIES: 'support_bot_appeal_categories',
    APPEAL_SOFTWARE: 'support_bot_appeal_software',
    APPEAL_STATUSES: 'support_bot_appeal_statuses',
    APPEAL_CRITICALITY: 'support_bot_appeal_criticality',
    USER_RELATIONS: 'support_bot_user_relations',
    CHATS: 'support_bot_chats',
    COMMUNICATIONS: 'support_bot_communications',
    MESSENGERS: 'support_bot_messengers',
    CHAT_TYPES: 'support_bot_chat_types',
    APPEAL_IMAGES: 'support_bot_appeal_images',
    USER_STATES: 'support_bot_user_states',
    SUPPORT_STAFF: 'support_bot_support_staff',
} as const;

export interface SupportStaff {
    id: string;      // PK: STAFF#<userId>
    sk: string;      // SK: METADATA
    userId: string;  // хранит USER#<cuid> из таблицы User
    createdAt: string;
}

// ============================================================================
// ID Prefixes
// ============================================================================

export const ID_PREFIXES = {
    USER: 'USER',
    ROLE: 'ROLE',
    APPEAL: 'APPEAL',
    APPEAL_USER: 'APPEALUSER',
    SOLUTION: 'SOLUTION',
    SUBDIVISION: 'SUBDIVISION',
    CATEGORY: 'CATEGORY',
    SOFTWARE: 'SOFTWARE',
    STATUS: 'STATUS',
    CRITICALITY: 'CRITICALITY',
    RELATION: 'RELATION',
    CHAT: 'CHAT',
    COMM: 'COMM',
    MESSENGER: 'MESSENGER',
    CHATTYPE: 'CHATTYPE',
    IMAGE: 'IMAGE',
    USER_STATE: 'USER_STATE',
    SUPPORT_STATE: 'SUPPORT_STATE',
    SUPPORT_STAFF: 'STAFF',
} as const;

export const METADATA_SK = 'METADATA';

// ============================================================================
// Appeal Status Names (из словаря статусов документации)
// ============================================================================
export const APPEAL_STATUS_NAMES = {
    CREATED: 'Created',
    VIEWED: 'Viewed',
    IN_PROGRESS: 'In_progress',
    WAITING_FOR_EXTERNAL: 'Waiting_for_external',
    DECIDED: 'Decided',
    CLOSED: 'Closed',
} as const;
export type AppealStatusName = typeof APPEAL_STATUS_NAMES[keyof typeof APPEAL_STATUS_NAMES];

// ============================================================================
// Helper Functions
// ============================================================================

export function createEntityId(
    prefix: keyof typeof ID_PREFIXES,
    cuid: string,
): string {
    return `${ID_PREFIXES[prefix]}#${cuid}`;
}

export function extractCuid(entityId: string): string {
    return entityId.split('#')[1] || '';
}

export function getPrefix(entityId: string): string {
    return entityId.split('#')[0] || '';
}

// ============================================================================
// Input Types (for creation)
// ============================================================================

export interface UserCreateInput {
    firstName: string;
    lastName: string;
    email: string;
    hashedPassword: string;
    roleId: string;
}

export interface AppealCreateInput {
    textOfTheAppeal: string;
    appealSubdivisionId: string;
    appealCategoryId: string;
    appealSoftwareId: string;
    appealStatusId: string;
    appealCriticalityId: string;
    solutionId?: string;
}

export interface AppealUserCreateInput {
    appealId: string;
    userId: string;
    userMessengerId: string;
    relationId: string;
}

export interface SolutionCreateInput {
    solutionText: string;
}

export interface ChatCreateInput {
    messengerId: string;
    chatMessengerId: string;
    chatTypeId: string;
}

export interface CommunicationCreateInput {
    chatId: string;
    userId: string;
    userMessengerId: string;
    email?: string;
    numberPhone?: string;
}

export interface AppealImageCreateInput {
    appealId: string;
    fileName: string;
}

export interface UserStateCreateInput {
    userId: string;
    snapshot: any; // XState snapshot
    context?: Record<string, any>;
    currentState: string;
    machineType: string;
}

export interface SupportAppealStateCreateInput {
    appealId: string;
    snapshot: any; // XState snapshot
    context?: Record<string, any>;
    currentState: string;
    machineType: string;
}

export interface ReferenceCreateInput {
    name: string;
}
