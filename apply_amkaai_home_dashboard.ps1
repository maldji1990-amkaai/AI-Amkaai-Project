$ErrorActionPreference = "Stop"

Set-Location "C:\Users\user\Desktop\ai-video-site"

Write-Host "AMKAAI: converting / to the current dashboard/generate UI..." -ForegroundColor Cyan

# Backup the two files before editing.
Copy-Item ".\app\page.tsx" ".\app\page.tsx.before-home-dashboard.bak" -Force
Copy-Item ".\app\dashboard\generate\page.tsx" ".\app\dashboard\generate\page.tsx.before-home-dashboard.bak" -Force

# 1) Make the dashboard/generate interface the public root interface.
# The page remains public visually, while its generation APIs stay protected.
@'
export { default } from "./dashboard/generate/page";
'@ | Set-Content ".\app\page.tsx" -Encoding utf8

# 2) Preserve authentication/permissions inside the shared generation UI.
$file = ".\app\dashboard\generate\page.tsx"
$content = Get-Content $file -Raw

if ($content -notmatch 'import \{ useAuth \} from "@clerk/nextjs";') {
    $content = $content.Replace(
        'import { VIDEO_CREDITS_PER_SECOND } from "@/lib/config";',
        'import { VIDEO_CREDITS_PER_SECOND } from "@/lib/config";' + [Environment]::NewLine + 'import { useAuth } from "@clerk/nextjs";'
    )
}

if ($content -notmatch 'const \{ isSignedIn \} = useAuth\(\);') {
    $content = $content.Replace(
        'export default function AIChangeConsole() {' + [Environment]::NewLine,
        'export default function AIChangeConsole() {' + [Environment]::NewLine + '  const { isSignedIn } = useAuth();' + [Environment]::NewLine
    )
}

$content = $content.Replace(
    'useEffect(() => {' + [Environment]::NewLine + '    fetch("/api/user", { cache: "no-store" })',
    'useEffect(() => {' + [Environment]::NewLine + '    if (!isSignedIn) return;' + [Environment]::NewLine + '    fetch("/api/user", { cache: "no-store" })'
)

$content = $content.Replace(
    '  }, []);' + [Environment]::NewLine + '  const createChat',
    '  }, [isSignedIn]);' + [Environment]::NewLine + '  const createChat'
)

$content = $content.Replace(
    '  const handleGenerateVideo = async () => {' + [Environment]::NewLine + '    if (!prompt.trim() || !activeChat) return alert("الرجاء كتابة الوصف النصي أولاً!");',
    '  const handleGenerateVideo = async () => {' + [Environment]::NewLine + '    if (!isSignedIn) {' + [Environment]::NewLine + '      window.location.href = "/sign-in?redirect_url=/";' + [Environment]::NewLine + '      return;' + [Environment]::NewLine + '    }' + [Environment]::NewLine + '    if (!prompt.trim() || !activeChat) return alert("الرجاء كتابة الوصف النصي أولاً!");'
)

# Remove the fake "Allocation State / {credits} Nodes" block completely.
$oldBlock = @'
            <div className="p-4 border-t border-white/5 bg-black/30">
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 flex justify-between items-center text-xs">
                <span className="text-gray-400 font-mono">Allocation State</span>
                <span className="font-bold text-purple-400 font-mono">{credits} Nodes</span>
              </div>
            </div>
'@
$content = $content.Replace($oldBlock, "")

Set-Content $file $content -Encoding utf8

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Changes:"
Write-Host "  - / now renders the same interface as /dashboard/generate"
Write-Host "  - Login/authentication remains enforced before generation"
Write-Host "  - API permissions are untouched"
Write-Host "  - Fake Allocation State / Nodes display removed"
Write-Host ""
Write-Host "Next run:"
Write-Host "  npm run build"
Write-Host ""
Write-Host "If build succeeds:"
Write-Host "  git add app/page.tsx app/dashboard/generate/page.tsx"
Write-Host '  git commit -m "Make dashboard the main homepage and remove fake nodes display"'
Write-Host "  git push origin main"
