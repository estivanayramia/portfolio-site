$injection = @"
<script>
(function() {
    var originalAudioContext = window.AudioContext || window.webkitAudioContext;
    var audioContexts = [];
    
    if (originalAudioContext) {
        window.AudioContext = function() {
            var ctx = new originalAudioContext();
            audioContexts.push(ctx);
            return ctx;
        };
        window.AudioContext.prototype = originalAudioContext.prototype;
    }

    window.addEventListener('message', function(event) {
        if (event.data.type === 'toggle-pause') {
            var keyEvent = new KeyboardEvent('keydown', {
                key: 'p',
                code: 'KeyP',
                keyCode: 80,
                which: 80,
                bubbles: true,
                cancelable: true,
                view: window
            });
            document.dispatchEvent(keyEvent);
            
            var escEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true,
                view: window
            });
            document.dispatchEvent(escEvent);
        } else if (event.data.type === 'set-mute') {
            var shouldMute = event.data.muted;
            audioContexts.forEach(function(ctx) {
                if (shouldMute) {
                    ctx.suspend();
                } else {
                    ctx.resume();
                }
            });
        }
    });
})();
</script>
"@

$games = Get-ChildItem "c:\Users\estiv\portfolio-site\assets\MiniGames" -Directory

foreach ($game in $games) {
    $indexPath = Join-Path $game.FullName "index.html"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw
        if ($content -notmatch "window.addEventListener\('message'") {
            if ($content -match "</body>") {
                $content = $content -replace "</body>", "$injection`n</body>"
            } elseif ($content -match "</html>") {
                $content = $content -replace "</html>", "$injection`n</html>"
            } else {
                $content = $content + "`n$injection"
            }
            Set-Content $indexPath -Value $content -Encoding UTF8
            Write-Host "Injected into $($game.Name)"
        } else {
            Write-Host "Skipping $($game.Name) (already injected)"
        }
    }
}
