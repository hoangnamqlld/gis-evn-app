module.exports = {
  testEnvironment: 'node',
  verbose: true,
  forceExit: true,
  testMatch: ["<rootDir>/*.test.js"], // Chạy tất cả file .test.js ở thư mục gốc
  testPathIgnorePatterns: ["/node_modules/"],
  transform: {}
};