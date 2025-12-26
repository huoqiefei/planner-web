import { User, UserRole } from '../types';

/// <reference types="vite/client" />

// Mock Typecho response structure
interface TypechoLoginResponse {
    status: number;
    data: {
        uid: string;
        name: string;
        mail: string;
        group: string; // 'administrator', 'editor', 'contributor', 'subscriber', 'visitor'
        token: string;
    };
    message?: string;
}

const STORAGE_KEY = 'planner_user_session';

export const authService = {
    // API Base URL (Update this to your Typecho URL)
    baseUrl: (import.meta as any).env.DEV ? '/api' : 'https://board.centrekit.com/index.php/planner/api',

    async login(username: string, password: string): Promise<User> {
        // // Real API Call Implementation
      
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`Login failed (${response.status}): ${text}`);
            }
            
            const data = await response.json();
            console.log('Login API Response:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            // Handle potential response structure variations
            // Structure 1: { token: '...', user: { ... } } (Matched by Action.php)
            // Structure 2: { data: { ...user_fields, token: '...' } } (Matched by interface)
            
            let userData = data.user;
            let token = data.token;

            if (!userData && data.data) {
                userData = data.data;
                token = data.data.token || token;
            }

            if (!userData) {
                 throw new Error('Invalid server response: missing user data');
            }

            const typechoGroup = userData.group;
            
            // Check for custom authorization category in meta
            const authCategory = userData.meta?.planner_auth_group || typechoGroup;
            
            const user: User = {
                uid: (userData.uid || '').toString(),
                name: userData.name || userData.screenName || userData.username || 'User',
                mail: userData.mail || userData.email || '',
                group: this.mapTypechoGroupToRole(authCategory),
                token: token || userData.token,
                avatar: userData.avatar,
                plannerRole: userData.plannerRole || userData.planner_role || 'trial',
                usage: userData.usage
            };
            
            this.saveUser(user);
            return user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async register(username: string, password: string, email: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, mail: email })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }
        } catch (error: any) {
            console.error('Registration error:', error);
            throw new Error(error.message || 'Registration failed');
        }
    },

    async updateProfile(data: { nickname?: string; avatar?: File }): Promise<{ avatarUrl?: string }> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const formData = new FormData();
        if (data.nickname) formData.append('screenName', data.nickname);
        if (data.avatar) formData.append('avatar', data.avatar);

        try {
            // Append token to URL as fallback for header stripping
            const response = await fetch(`${this.baseUrl}/update_profile?token=${user.token}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`
                },
                body: formData
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`Update failed (${response.status}): ${text}`);
            }

            const result = await response.json();
            if (result.error) throw new Error(result.error);
            
            // Update local user data if successful
            const currentUser = this.getCurrentUser();
            if (currentUser) {
                if (data.nickname) currentUser.name = data.nickname;
                if (result.avatar) currentUser.avatar = result.avatar;
                this.saveUser(currentUser);
            }

            return result;
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    },

    async adminUserList(page: number = 1, pageSize: number = 20): Promise<any> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/admin_user_list?page=${page}&pageSize=${pageSize}&token=${user.token}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${user.token}`
            }
        });
        
        if (!response.ok) throw new Error(`Failed to load users: ${response.statusText}`);
        return await response.json();
    },

    async adminUserUpdate(uid: number, role: 'trial' | 'licensed' | 'premium'): Promise<void> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/admin_user_update?token=${user.token}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ uid, role })
        });
        
        if (!response.ok) throw new Error(`Failed to update user: ${response.statusText}`);
    },

    async changePassword(oldPassword: string, newPassword: string): Promise<void> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/change_password?token=${user.token}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Password change failed (${response.status}): ${text}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
    },

    async getPublicConfig(): Promise<any> {
        const response = await fetch(`${this.baseUrl}/public_config`);
        return await response.json();
    },

    logout() {
        localStorage.removeItem(STORAGE_KEY);
    },

    getCurrentUser(): User | null {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return null;
    },

    saveUser(user: User) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    },

    // Helper to map Typecho groups to our roles
    mapTypechoGroupToRole(group: string): UserRole {
        switch (group) {
            case 'administrator': return 'admin';
            case 'editor': return 'editor';
            case 'contributor': return 'editor';
            case 'subscriber': return 'editor';
            default: return 'viewer';
        }
    },

    async getProjects(): Promise<any[]> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/project_list?token=${user.token}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to load projects (${response.status}): ${text}`);
        }

        const data = await response.json();
        return data.projects || [];
    },

    async saveProject(project: { id?: number, name: string, description?: string, content: any }): Promise<any> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/project_save?token=${user.token}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(project)
        });
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to save project (${response.status}): ${text}`);
        }
        
        return await response.json();
    },

    async getProject(id: number): Promise<any> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/project_get?id=${id}&token=${user.token}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        
        if (!response.ok) {
             throw new Error(`Failed to load project (${response.status})`);
        }
        
        return await response.json();
    },

    async deleteProject(id: number): Promise<void> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/project_delete?token=${user.token}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ id })
        });
        
        if (!response.ok) {
             throw new Error(`Failed to delete project (${response.status})`);
        }
    },

    async getSystemConfig(): Promise<any> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        const response = await fetch(`${this.baseUrl}/sys_config_get?token=${user.token}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        
        if (!response.ok) throw new Error(`Failed to load config`);
        
        return await response.json();
    },

    async saveSystemConfig(config: any): Promise<void> {
        const user = this.getCurrentUser();
        if (!user || !user.token) throw new Error('Not authenticated');

        await fetch(`${this.baseUrl}/sys_config_save?token=${user.token}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify(config)
        });
        // Assuming success if no throw, or add response.ok check
    }
};
