// services/driveAuthService.ts
import { OAuth2Client } from 'google-auth-library';

class DriveAuthService {
  private oauth2Client: OAuth2Client;
  
  constructor() {
    this.oauth2Client = new OAuth2Client(
      import.meta.env.VITE_GOOGLE_CLIENT_ID,
      import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
      import.meta.env.VITE_GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Tạo URL xác thực
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file', // Chỉ file do app tạo
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Luôn yêu cầu refresh token
      include_granted_scopes: true
    });
  }

  /**
   * Lấy token từ code
   */
  async getToken(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Lưu tokens vào localStorage
      localStorage.setItem('drive_tokens', JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      }));
      
      console.log('✅ Đã lưu Google Drive tokens');
    } catch (error) {
      console.error('❌ Lỗi lấy token:', error);
      throw error;
    }
  }

  /**
   * Lấy access token (tự động refresh nếu cần)
   */
  async getAccessToken(): Promise<string> {
    try {
      const tokens = JSON.parse(localStorage.getItem('drive_tokens') || '{}');
      
      if (!tokens.access_token) {
        throw new Error('Chưa đăng nhập Google Drive');
      }

      this.oauth2Client.setCredentials(tokens);
      
      // Kiểm tra token hết hạn
      if (this.oauth2Client.isTokenExpiring()) {
        console.log('🔄 Token sắp hết hạn, đang refresh...');
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
        
        // Cập nhật localStorage
        localStorage.setItem('drive_tokens', JSON.stringify({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokens.refresh_token,
          expiry_date: credentials.expiry_date
        }));
        
        console.log('✅ Đã refresh token');
      }
      
      return this.oauth2Client.credentials.access_token!;
      
    } catch (error) {
      console.error('❌ Lỗi lấy access token:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra đã đăng nhập Drive chưa
   */
  isAuthenticated(): boolean {
    const tokens = localStorage.getItem('drive_tokens');
    return !!tokens;
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
    const token = await this.getAccessToken();
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  }
}

export default new DriveAuthService();