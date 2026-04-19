// driveConfig.ts — Cấu hình Google Drive folder cho PowerMind
// Folder này là chỗ công nhân upload submissions + photos.

export const DRIVE_CONFIG = {
  // Folder chính (shared bởi admin)
  ROOT_FOLDER_ID:   '1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR',
  ROOT_FOLDER_URL:  'https://drive.google.com/drive/folders/1vSYVCjGCpcIyG2D2UkhJ-QrhwSLY1pOR',

  // Các sub-folder (tên phải trùng với folder đã tạo trên Drive)
  SUBFOLDERS: {
    SUBMISSIONS: 'submissions',
    PHOTOS:      'photos',
    INSPECTIONS: 'inspections',
  },

  // Pattern đặt tên file để dễ quản lý
  // Ví dụ: submissions/2026-04-19/PE09000040120_1713524000.json
  getSubmissionPath: (collectorId: string, timestamp: number): string => {
    const date = new Date(timestamp).toISOString().split('T')[0];
    return `submissions/${date}/${collectorId}_${timestamp}.json`;
  },

  getPhotoPath: (submissionId: string, timestamp: number, idx: number): string => {
    const date = new Date(timestamp).toISOString().split('T')[0];
    return `photos/${date}/${submissionId}_${idx}.jpg`;
  },

  getInspectionPath: (collectorId: string, timestamp: number): string => {
    const date = new Date(timestamp).toISOString().split('T')[0];
    return `inspections/${date}/${collectorId}_${timestamp}.json`;
  },
};
