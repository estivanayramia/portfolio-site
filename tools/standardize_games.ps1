$files = Get-ChildItem "c:\Users\estiv\portfolio-site\hobbies-games\*.html"

$newStyle = @"
  <style>
    /* Standardized Responsive Game Container */
    body { 
        margin: 0; 
        padding: 0; 
        background: #1a1f35; 
        overflow: hidden; /* Prevent body scroll, let game container handle it if needed */
        height: 100vh; 
        width: 100vw;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .game-wrapper { 
        display: flex; 
        flex-direction: column; 
        height: 100%; 
        width: 100%; 
    }

    .game-header { 
        flex: 0 0 auto; 
        padding: 1rem 1.5rem; 
        display: flex; 
        align-items: center; 
        gap: 1rem; 
        background: rgba(33,40,66,0.95); 
        border-bottom: 1px solid rgba(255,255,255,0.05); 
        backdrop-filter: blur(10px);
        z-index: 50;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }

    .back-link { 
        color: #e1d4c2; 
        text-decoration: none; 
        font-weight: 600; 
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
        font-size: 0.9rem;
        transition: all 0.2s ease;
        padding: 0.5rem 0.75rem;
        border-radius: 0.5rem;
        background: rgba(255,255,255,0.05);
    }

    .back-link:hover { 
        background: rgba(255,255,255,0.1);
        transform: translateX(-2px);
    }

    .game-title { 
        color: #fff; 
        font-size: 1.1rem; 
        font-weight: 700; 
        margin: 0; 
        letter-spacing: -0.01em;
    }

    .game-frame-container { 
        flex: 1; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        padding: 1.5rem; 
        overflow: hidden;
        position: relative;
        background-image: radial-gradient(circle at center, #2a3250 0%, #131620 100%);
    }

    .game-frame { 
        width: 100%; 
        height: 100%; 
        max-width: 1200px; 
        max-height: 100%; 
        border: none; 
        border-radius: 12px; 
        background: #000; 
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        transition: all 0.3s ease;
    }

    /* Mobile / Responsive Adjustments */
    @media (max-width: 768px) {
        .game-header { 
            padding: 0.75rem 1rem; 
        }
        
        .game-frame-container { 
            padding: 0; 
            background: #000;
        }
        
        .game-frame { 
            border-radius: 0; 
            max-width: 100%;
        }
        
        .back-link span {
            display: none; /* Hide text on very small screens if needed, but keeping for now */
        }
    }

    /* Custom Scrollbar (if needed inside iframe content) */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: rgba(33, 40, 66, 0.1); }
    ::-webkit-scrollbar-thumb { background: rgba(54, 32, 23, 0.5); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(54, 32, 23, 0.8); }
  </style>
"@

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    # Regex to replace the style block
    $content = $content -replace '(?s)<style>.*?</style>', $newStyle
    Set-Content -Path $file.FullName -Value $content
    Write-Host "Updated $($file.Name)"
}
