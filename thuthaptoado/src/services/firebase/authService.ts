// src/services/firebase/authService.ts
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import app from './config'; // 👈 Import default, không phải { app }

class AuthService {
  private auth = getAuth(app);

  constructor() {
    console.log('🔐 AuthService initialized');
    
    if (this.auth) {
      console.log('✅ Auth instance ready');
    } else {
      console.error('❌ Auth instance not available');
    }
  }

  async login(email: string, password: string): Promise<User> {
    try {
      console.log('🔐 Attempting login:', email);
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      localStorage.setItem('evnhcmc_login_date', new Date().toISOString().split('T')[0]);
      localStorage.setItem('evnhcmc_user_name', result.user.displayName || result.user.email?.split('@')[0] || '');
      localStorage.setItem('evnhcmc_unit', this.extractUnitFromEmail(result.user.email || ''));
      
      console.log('✅ Login successful:', result.user.email);
      return result.user;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      localStorage.removeItem('evnhcmc_login_date');
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    if (!this.auth) {
      console.error('❌ Auth not initialized');
      callback(null);
      return () => {};
    }
    
    console.log('👤 Setting up auth state listener');
    return onAuthStateChanged(this.auth, (user) => {
      console.log('👤 Auth state changed:', user ? user.email : 'logged out');
      callback(user);
    });
  }

  getCurrentUser(): User | null {
    if (!this.auth) return null;
    return this.auth.currentUser;
  }

  extractUnitFromEmail(email: string): string {
    const units = ['pccch', 'pcbca', 'pcbd', 'pcvt', 'pcdd'];
    const emailLower = email.toLowerCase();
    
    for (const unit of units) {
      if (emailLower.includes(unit)) {
        return unit.toUpperCase();
      }
    }
    
    return 'PCCCH';
  }
}

export default new AuthService();