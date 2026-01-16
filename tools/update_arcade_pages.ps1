$files = Get-ChildItem "c:\Users\estiv\portfolio-site\hobbies-games\*.html"

$buttonHtml = @"
      <div style="margin-left: auto; display: flex; gap: 10px;">
        <button id="game-pause-btn" onclick="toggleGamePause()" style="background: #ca8a04; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Pause</button>
        <button id="game-mute-btn" onclick="toggleGameMute()" style="background: #312e81; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background 0.2s;">🔊</button>
      </div>
"@

$scriptHtml = @"
  <script>
    let isGamePaused = false;
    let isGameMuted = false;
    const iframe = document.querySelector('iframe');

    function toggleGamePause() {
        isGamePaused = !isGamePaused;
        const btn = document.getElementById('game-pause-btn');
        if (isGamePaused) {
            btn.textContent = 'Resume';
            btn.style.backgroundColor = '#16a34a'; // Green
        } else {
            btn.textContent = 'Pause';
            btn.style.backgroundColor = '#ca8a04'; // Yellow
        }
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'toggle-pause' }, '*');
            iframe.focus();
        }
    }

    function toggleGameMute() {
        isGameMuted = !isGameMuted;
        const btn = document.getElementById('game-mute-btn');
        btn.textContent = isGameMuted ? '🔇' : '🔊';
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'set-mute', muted: isGameMuted }, '*');
        }
    }

    // Handle global keys (P for pause)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') {
            toggleGamePause();
        }
    });
  </script>
"@

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Inject Buttons if not present
    if ($content -notmatch "id=`"game-pause-btn`"") {
        if ($content -match '<header class="game-header">([\s\S]*?)</header>') {
            $content = $content -replace '(<header class="game-header">[\s\S]*?)(</header>)', "`$1$buttonHtml`$2"
            Write-Host "Added buttons to $($file.Name)"
        } else {
            Write-Warning "Could not find header in $($file.Name)"
        }
    } else {
        Write-Host "Buttons already present in $($file.Name)"
    }

    # Inject Script if not present
    if ($content -notmatch "function toggleGamePause") {
        if ($content -match "</body>") {
            $content = $content -replace "</body>", "$scriptHtml`n</body>"
            Write-Host "Added script to $($file.Name)"
        } else {
            $content = $content + "`n$scriptHtml"
            Write-Host "Appended script to $($file.Name)"
        }
    } else {
        Write-Host "Script already present in $($file.Name)"
    }

    Set-Content $file.FullName -Value $content -Encoding UTF8
}
