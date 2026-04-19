# check-src.ps1
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "    KIỂM TRA TOÀN BỘ THƯ MỤC SRC" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Hàm đếm số dòng trong file
function Get-LineCount {
    param($file)
    try {
        return (Get-Content $file | Measure-Object -Line).Lines
    } catch {
        return 0
    }
}

# Hàm lấy kích thước file
function Get-FileSize {
    param($file)
    try {
        $size = (Get-Item $file).Length
        if ($size -lt 1KB) {
            return "$size bytes"
        } elseif ($size -lt 1MB) {
            return "{0:N2} KB" -f ($size / 1KB)
        } else {
            return "{0:N2} MB" -f ($size / 1MB)
        }
    } catch {
        return "0 bytes"
    }
}

# 1. KIỂM TRA CẤU TRÚC THƯ MỤC
Write-Host "📁 1. CẤU TRÚC THƯ MỤC" -ForegroundColor Yellow
Write-Host "-----------------------------------------"

$folders = @(
    "src/components",
    "src/services",
    "src/services/firebase",
    "src/utils",
    "src/hooks",
    "src/types",
    "src/pages"
)

foreach ($folder in $folders) {
    if (Test-Path $folder) {
        $fileCount = (Get-ChildItem -Path $folder -File | Measure-Object).Count
        Write-Host "✅ $folder ($fileCount files)" -ForegroundColor Green
    } else {
        Write-Host "❌ $folder (KHÔNG TỒN TẠI)" -ForegroundColor Red
    }
}

# 2. KIỂM TRA FILE QUAN TRỌNG
Write-Host "`n📄 2. FILE QUAN TRỌNG" -ForegroundColor Yellow
Write-Host "-----------------------------------------"

$importantFiles = @(
    # App chính
    @{path="src/App.tsx"; name="App chính"},
    @{path="src/index.tsx"; name="Entry point"},
    @{path="src/types/index.ts"; name="Type definitions"},
    
    # Components chính
    @{path="src/components/MapModule.tsx"; name="Map Module"},
    @{path="src/components/Dashboard.tsx"; name="Dashboard"},
    @{path="src/components/CollectionForm.tsx"; name="Collection Form"},
    @{path="src/components/AssetDetail.tsx"; name="Asset Detail"},
    @{path="src/components/LineDetail.tsx"; name="Line Detail"},
    @{path="src/components/CameraModule.tsx"; name="Camera Module"},
    @{path="src/components/SmartCameraModule.tsx"; name="Smart Camera"},
    @{path="src/components/FirebaseLogin.tsx"; name="Firebase Login"},
    
    # Services chính
    @{path="src/services/cloudService.ts"; name="Cloud Service"},
    @{path="src/services/useCloudSync.ts"; name="Cloud Sync Hook"},
    @{path="src/services/dualSyncService.ts"; name="Dual Sync"},
    @{path="src/services/driveAuthService.ts"; name="Drive Auth"},
    @{path="src/services/driveUploadService.ts"; name="Drive Upload"},
    
    # Firebase services
    @{path="src/services/firebase/config.ts"; name="Firebase Config"},
    @{path="src/services/firebase/authService.ts"; name="Firebase Auth"},
    @{path="src/services/firebase/poleService.ts"; name="Pole Service"},
    @{path="src/services/firebase/photoService.ts"; name="Photo Service"},
    @{path="src/services/firebase/syncService.ts"; name="Firebase Sync"},
    
    # Utils
    @{path="src/utils/vn2000.ts"; name="VN2000 Converter"},
    @{path="src/utils/math.ts"; name="Math Utils"},
    @{path="src/utils/ocrUtils.ts"; name="OCR Utils"},
    @{path="src/utils/qrGenerator.ts"; name="QR Generator"},
    
    # Hooks
    @{path="src/hooks/useSmartCapture.ts"; name="Smart Capture Hook"}
)

$missingCount = 0
$totalSize = 0

foreach ($file in $importantFiles) {
    if (Test-Path $file.path) {
        $lineCount = Get-LineCount $file.path
        $size = Get-FileSize $file.path
        Write-Host "✅ $($file.path)" -ForegroundColor Green -NoNewline
        Write-Host " ($($file.name))" -ForegroundColor White -NoNewline
        Write-Host " - $lineCount dòng, $size" -ForegroundColor Gray
        $totalSize += (Get-Item $file.path).Length
    } else {
        Write-Host "❌ $($file.path)" -ForegroundColor Red -NoNewline
        Write-Host " ($($file.name))" -ForegroundColor White
        $missingCount++
    }
}

# 3. LIỆT KÊ TẤT CẢ FILE THEO THƯ MỤC
Write-Host "`n📂 3. DANH SÁCH TẤT CẢ FILE" -ForegroundColor Yellow
Write-Host "-----------------------------------------"

$rootFiles = Get-ChildItem -Path src -File
Write-Host "`n📁 Thư mục gốc src/: $($rootFiles.Count) files" -ForegroundColor Magenta
foreach ($file in $rootFiles) {
    $lineCount = Get-LineCount $file.FullName
    $size = Get-FileSize $file.FullName
    Write-Host "   📄 $($file.Name) - $lineCount dòng, $size" -ForegroundColor White
}

$subFolders = @("components", "services", "utils", "hooks", "types", "pages")
foreach ($subFolder in $subFolders) {
    $folderPath = "src/$subFolder"
    if (Test-Path $folderPath) {
        $files = Get-ChildItem -Path $folderPath -File
        Write-Host "`n📁 Thư mục $subFolder/: $($files.Count) files" -ForegroundColor Magenta
        foreach ($file in $files) {
            $lineCount = Get-LineCount $file.FullName
            $size = Get-FileSize $file.FullName
            Write-Host "   📄 $($file.Name) - $lineCount dòng, $size" -ForegroundColor White
        }
        
        # Kiểm tra thư mục con của services
        if ($subFolder -eq "services") {
            $firebasePath = "src/services/firebase"
            if (Test-Path $firebasePath) {
                $firebaseFiles = Get-ChildItem -Path $firebasePath -File
                Write-Host "`n   📁 firebase/: $($firebaseFiles.Count) files" -ForegroundColor Cyan
                foreach ($file in $firebaseFiles) {
                    $lineCount = Get-LineCount $file.FullName
                    $size = Get-FileSize $file.FullName
                    Write-Host "      📄 $($file.Name) - $lineCount dòng, $size" -ForegroundColor White
                }
            }
        }
    }
}

# 4. THỐNG KÊ TỔNG QUAN
Write-Host "`n📊 4. THỐNG KÊ TỔNG QUAN" -ForegroundColor Yellow
Write-Host "-----------------------------------------"

$totalFiles = (Get-ChildItem -Path src -Recurse -File | Measure-Object).Count
$totalLines = 0
$totalSizeBytes = 0

Get-ChildItem -Path src -Recurse -File | ForEach-Object {
    $totalLines += (Get-Content $_.FullName | Measure-Object -Line).Lines
    $totalSizeBytes += $_.Length
}

$totalSizeMB = $totalSizeBytes / 1MB

Write-Host "📦 Tổng số files: $totalFiles" -ForegroundColor Green
Write-Host "📝 Tổng số dòng code: $totalLines" -ForegroundColor Green
Write-Host "💾 Tổng dung lượng: {0:N2} MB" -f $totalSizeMB -ForegroundColor Green

if ($missingCount -eq 0) {
    Write-Host "`n✅ TẤT CẢ FILE QUAN TRỌNG ĐÃ TỒN TẠI!" -ForegroundColor Green
} else {
    Write-Host "`n❌ CÒN THIẾU $missingCount FILE QUAN TRỌNG!" -ForegroundColor Red
}

Write-Host "`n=========================================" -ForegroundColor Cyan