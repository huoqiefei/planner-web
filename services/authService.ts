import { User, UserRole } from '../types';

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
    baseUrl: import.meta.env.DEV ? '/api' : 'https://board.centrekit.com/index.php/planner/api',

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
            const typechoGroup = data.user.group;
            
            // Check for custom authorization category in meta
            const authCategory = data.user.meta?.planner_auth_group || typechoGroup;
            
            const user: User = {
                uid: data.user.uid.toString(),
                name: data.user.name,
                mail: data.user.mail,
                group: this.mapTypechoGroupToRole(authCategory),
                token: data.token
            };
            
            this.saveUser(user);
            return user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    

        // Mocking logic for demonstration
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

        // if (username === 'admin' && password === 'admin') {
        //     const user: User = {
        //         uid: '1',
        //         name: 'Administrator',
        //         mail: 'admin@example.com',
        //         group: 'admin',
        //         token: 'mock-jwt-token-admin'
        //     };
        //     this.saveUser(user);
        //     return user;
        // } else if (username === 'editor' && password === 'editor') {
        //      const user: User = {
        //         uid: '2',
        //         name: 'Editor',
        //         mail: 'editor@example.com',
        //         group: 'editor',
        //         token: 'mock-jwt-token-editor'
        //     };
        //     this.saveUser(user);
        //     return user;
        // } else if (username === 'viewer' && password === 'viewer') {
        //      const user: User = {
        //         uid: '3',
        //         name: 'Viewer',
        //         mail: 'viewer@example.com',
        //         group: 'viewer',
        //         token: 'mock-jwt-token-viewer'
        //     };
        //     this.saveUser(user);
        //     return user;
        // }

        throw new Error('Invalid credentials');
    },

    async register(username: string, password: string, email: string): Promise<void> {
        // TODO: Replace with Typecho registration API
        await new Promise(resolve => setTimeout(resolve, 500));
        // Mock success
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
            default: return 'viewer';
        }
    }
};
