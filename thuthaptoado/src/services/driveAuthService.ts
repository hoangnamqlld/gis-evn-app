// src/services/driveAuthService.ts

class DriveAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  
  // Các hằng số
  private readonly authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenEndpoint = 'https://oauth2.googleapis.com/token';

  constructor() {
    // Hàm an toàn để đọc biến môi trường - SỬA LỖI DÒNG 19
    const getEnvVar = (key: string, defaultValue: string = ''): string => {
      try {
        // Kiểm tra môi trường Vite
        if (typeof import.meta !== 'undefined') {
          // SỬA: Kiểm tra import.meta.env tồn tại an toàn
          const env = (import.meta as any).env;
          if (env && typeof env === 'object') {
            const value = env[key];
            if (value && typeof value === 'string' && value.trim() !== '') {
              return value;
            }
          }
        }
        
        // Kiểm tra process.env (Node.js / fallback)
        if (typeof process !== 'undefined' && process.env) {
          const value = process.env[key];
          if (value && typeof value === 'string' && value.trim() !== '') {
            return value;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Không thể đọc biến môi trường ${key}:`, error);
      }
      
      return defaultValue;
    };

    // Lấy từ environment với fallback
    this.clientId = getEnvVar('VITE_GOOGLE_CLIENT_ID', '');
    this.clientSecret = getEnvVar('VITE_GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = getEnvVar('VITE_GOOGLE_REDIRECT_URI', 'http://localhost:3000/oauth2callback');
    
    // Log cấu hình (ẩn secret)
    console.log('🔐 DriveAuthService initialized:', {
      clientId: this.clientId ? '✓' : '✗',
      clientSecret: this.clientSecret ? '✓' : '✗',
      redirectUri: this.redirectUri
    });
  }

  /**
   * Tạo URL xác thực
   */
  getAuthUrl(): string {
    // Kiểm tra clientId trước khi tạo URL
    if (!this.clientId) {
      console.error('❌ Missing VITE_GOOGLE_CLIENT_ID');
      return '#';
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true'
    });

    const url = `${this.authEndpoint}?${params.toString()}`;
    console.log('🔗 Auth URL generated:', url.substring(0, 100) + '...');
    
    return url;
  }

  /**
   * Lấy token từ code
   */
  async getToken(code: string): Promise<void> {
    try {
      console.log('🔄 Đang lấy token từ code...');
      
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Missing Google OAuth credentials');
      }

      const params = new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const tokens = await response.json();
      
      // Lưu tokens vào localStorage
      localStorage.setItem('drive_tokens', JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (tokens.expires_in * 1000)
      }));
      
      console.log('✅ Đã lưu Google Drive tokens');
    } catch (error) {
      console.error('❌ Lỗi lấy token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<any> {
    try {
      console.log('🔄 Đang refresh token...');
      
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Missing Google OAuth credentials');
      }

      const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token'
      });

      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Refresh token thành công');
      return data;
    } catch (error) {
      console.error('❌ Lỗi refresh token:', error);
      throw error;
    }
  }

  /**
   * Lấy access token (tự động refresh nếu cần)
   */
  async getAccessToken(): Promise<string> {
    try {
      const tokensStr = localStorage.getItem('drive_tokens');
      if (!tokensStr) {
        throw new Error('Chưa đăng nhập Google Drive');
      }

      const tokens = JSON.parse(tokensStr);
      
      if (!tokens.access_token) {
        throw new Error('Chưa đăng nhập Google Drive');
      }

      // Kiểm tra token hết hạn
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        console.log('🔄 Token hết hạn, đang refresh...');
        
        if (!tokens.refresh_token) {
          throw new Error('Không có refresh token');
        }

        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        
        // Cập nhật localStorage
        const updatedTokens = {
          access_token: newTokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: Date.now() + (newTokens.expires_in * 1000)
        };
        
        localStorage.setItem('drive_tokens', JSON.stringify(updatedTokens));
        
        console.log('✅ Đã refresh token');
        return updatedTokens.access_token;
      }
      
      return tokens.access_token;
      
    } catch (error) {
      console.error('❌ Lỗi lấy access token:', error);
      throw error;
    }
  }

  /**
   * Lấy access token đồng bộ (cho các trường hợp không async được)
   */
  getAccessTokenSync(): string | null {
    try {
      const tokensStr = localStorage.getItem('drive_tokens');
      if (!tokensStr) return null;
      
      const tokens = JSON.parse(tokensStr);
      return tokens.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * Kiểm tra đã đăng nhập Drive chưa
   */
  isAuthenticated(): boolean {
    try {
      const tokensStr = localStorage.getItem('drive_tokens');
      if (!tokensStr) return false;
      
      const tokens = JSON.parse(tokensStr);
      return !!tokens.access_token;
    } catch {
      return false;
    }
  }

  /**
   * Đăng xuất Drive
   */
  logout(): void {
    localStorage.removeItem('drive_tokens');
    console.log('✅ Đã đăng xuất Google Drive');
  }

  /**
   * Lấy thông tin user
   */
  async getUserInfo(): Promise<any> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Lỗi lấy user info:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra cấu hình
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

// Export singleton instance
const driveAuthService = new DriveAuthService();
export default driveAuthService;