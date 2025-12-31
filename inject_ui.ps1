$games = Get-ChildItem "c:\Users\estiv\portfolio-site\assets\MiniGames" -Directory

$uiHtml = @"
<div id="arcade-ui" style="position: fixed; top: 20px; left: 20px; z-index: 9999; display: flex; gap: 10px; font-family: 'Inter', sans-serif;">
    <a href="/hobbies-games" style="text-decoration: none; background: rgba(33, 40, 66, 0.9); color: #e1d4c2; padding: 10px 20px; border-radius: 12px; font-weight: 600; border: 1px solid rgba(225, 212, 194, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.2s ease;">← Back</a>
    <button onclick="togglePause()" style="background: rgba(33, 40, 66, 0.9); color: #e1d4c2; padding: 10px 20px; border-radius: 12px; font-weight: 600; border: 1px solid rgba(225, 212, 194, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; transition: all 0.2s ease;">Pause</button>
</div>
<style>
    #arcade-ui a:hover, #arcade-ui button:hover { transform: translateY(-2px); background: rgba(54, 32, 23, 0.9); }
    #arcade-ui a:active, #arcade-ui button:active { transform: translateY(0); }
</style>
<script>
    function togglePause() {
        // Simulate P key
        const k = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', keyCode: 80, which: 80, bubbles: true });
        window.dispatchEvent(k);
        document.dispatchEvent(k);
        const canvas = document.querySelector('canvas');
        if(canvas) canvas.dispatchEvent(k);
    }
</script>
"@

foreach ($game in $games) {
    $indexPath = Join-Path $game.FullName "index.html"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw
        if ($content -notmatch "arcade-ui") {
            $content = $content -replace "</body>", "$uiHtml`n</body>"
            Set-Content $indexPath $content
            Write-Host "Injected UI into $($game.Name)"
        } else {
            Write-Host "UI already exists in $($game.Name)"
        }
    }
}
