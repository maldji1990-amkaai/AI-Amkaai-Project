$ErrorActionPreference = "Stop"

$project = "C:\Users\user\Desktop\ai-video-site"
Set-Location $project

Write-Host "=== AMKAAI routing correction ===" -ForegroundColor Cyan

Copy-Item -LiteralPath ".\app\page.tsx" -Destination ".\app\page.tsx.before-routing-fix.bak" -Force
Copy-Item -LiteralPath ".\app\sign-in\[[...sign-in]]\page.tsx" -Destination ".\app\sign-in\[[...sign-in]]\page.tsx.before-routing-fix.bak" -Force
Copy-Item -LiteralPath ".\app\dashboard\page.tsx" -Destination ".\app\dashboard\page.tsx.before-routing-fix.bak" -Force

git show 240a984:app/page.tsx | Set-Content -LiteralPath ".\app\page.tsx" -Encoding UTF8

$signInPath = ".\app\sign-in\[[...sign-in]]\page.tsx"
$signIn = Get-Content -LiteralPath $signInPath -Raw
$signIn = $signIn.Replace('fallbackRedirectUrl="/dashboard"', 'fallbackRedirectUrl="/"')
Set-Content -LiteralPath $signInPath -Value $signIn -Encoding UTF8

$dashboardPath = ".\app\dashboard\page.tsx"
$dashboard = Get-Content -LiteralPath $dashboardPath -Raw
$dashboard = $dashboard.Replace('redirect("/dashboard/generate");', 'redirect("/");')
Set-Content -LiteralPath $dashboardPath -Value $dashboard -Encoding UTF8

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "Login -> /"
Write-Host "/dashboard -> /"
Write-Host "AI Video Generator -> /dashboard/generate"
Write-Host ""
Write-Host "Next: npm run build"
