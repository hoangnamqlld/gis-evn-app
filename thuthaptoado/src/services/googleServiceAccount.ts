// src/services/googleServiceAccount.ts
export class GoogleServiceAccount {
  private clientEmail: string;
  private privateKey: string;
  
  constructor() {
    this.clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  }
  
  async getAccessToken(): Promise<string> {
    const jwt = this.createJWT();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });
    
    const data = await response.json();
    return data.access_token;
  }
  
  private createJWT(): string {
    // Tạo JWT với service account credentials
    // Implementation chi tiết
    return '';
  }
}