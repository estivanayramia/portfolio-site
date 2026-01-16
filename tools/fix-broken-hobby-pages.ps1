# Fix broken hobby pages (whispers, cooking, car)
# These files are missing their entire <head> section and start mid-CSS block

$pages = @{
    'whispers' = @{
        title = 'Whispers | Hobbies'
        desc = 'Whispers on Paper - handwritten notes left around SDSU campus for strangers to find, offering anonymous encouragement.'
        ogTitle = 'Whispers (Sticky Notes) | Estivan Ayramia'
        ogDesc = 'Daily handwritten notes left around SDSU campus for strangers'
    }
    'cooking' = @{
        title = 'Cooking | Hobbies'
        desc = 'Cooking experiments - trying recipes, learning techniques, and enjoying the process of making food from scratch.'
        ogTitle = 'Cooking | Estivan Ayramia'
        ogDesc = 'Learning through experimentation in the kitchen'
    }
    'car' = @{
        title = 'Car Enthusiasm | Hobbies'
        desc = 'Car enthusiasm - appreciating automotive design, following motorsports, and learning about vehicle mechanics.'
        ogTitle = 'Car Enthusiasm | Estivan Ayramia'
        ogDesc = 'Following automotive culture and motorsports'
    }
}

foreach ($page in $pages.Keys) {
    $meta = $pages[$page]
    $filePath = "c:\Users\estiv\portfolio-site\en\hobbies\$page.html"
    
    Write-Host "Fixing $page.html..."
    
    # Read the broken file
    $content = Get-Content $filePath -Raw
    
    # Extract just the body content (from <body to end)
    if ($content -match '(?s)(<body.*$)') {
        $bodyContent = $Matches[0]
        
        # Create proper HTML head
        $properHead = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="$($meta.desc)">
    <link rel="canonical" href="https://www.estivanayramia.com/en/hobbies/$page">
    <title>$($meta.title)</title>
    
    <!-- Open Graph / Social Media -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="$($meta.ogTitle)">
    <meta property="og:description" content="$($meta.ogDesc)">
    <meta property="og:url" content="https://www.estivanayramia.com/en/hobbies/$page">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="$($meta.ogTitle)">
    <meta name="twitter:description" content="$($meta.ogDesc)">
    
    <!-- Google Fonts: Inter (non-render-blocking) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" crossorigin media="(max-width: 768px)">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" crossorigin media="print" data-media="(min-width: 769px)">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" crossorigin></noscript>
    
    <!-- Preload Critical LCP Image -->
    <link rel="preload" as="image" href="/assets/img/logo-ea.webp" type="image/webp">
    
    <link rel="stylesheet" href="/assets/css/style.css">
    <link rel="preload" href="/assets/css/style.css" as="style">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" defer></script>
    <script src="/assets/js/site.min.js" defer></script>
    <!-- Custom Theme CSS -->
    <link rel="stylesheet" href="/assets/css/theme.css" media="(max-width: 768px)">
    <link rel="stylesheet" href="/assets/css/theme.css" media="print" data-media="(min-width: 769px)">
    <noscript><link rel="stylesheet" href="/assets/css/theme.css"></noscript>
    
    <!-- Analytics loaded via lazy-loader.js for better PageSpeed -->

    <!-- PWA Manifest -->
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/img/favicon-16x16.png">
    <link rel="shortcut icon" href="/assets/img/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
    <link rel="mask-icon" href="/assets/img/safari-pinned-tab.svg" color="#212842">
    <meta name="msapplication-TileColor" content="#212842">
    <meta name="msapplication-TileImage" content="/assets/img/favicon-32x32.png">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#212842">
    
    <!-- Carousel and Lightbox styles -->
    <style>
        .lightbox-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 9998;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        .lightbox-overlay.active { display: flex; }
        .lightbox-content {
            max-width: 90vw;
            max-height: 90vh;
            object-fit: contain;
        }
        .lightbox-close {
            position: absolute;
            top: 1rem;
            right: 1rem;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            background: none;
            border: none;
            padding: 0.5rem;
        }
        .lightbox-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            color: white;
            font-size: 2.5rem;
            cursor: pointer;
            background: rgba(0,0,0,0.5);
            border: none;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            transition: background 0.2s;
        }
        .lightbox-nav:hover { background: rgba(0,0,0,0.8); }
        .lightbox-prev { left: 1rem; }
        .lightbox-next { right: 1rem; }
        .gallery-carousel {
            position: relative;
            overflow: hidden;
        }
        .carousel-track {
            display: flex;
            transition: transform 0.5s ease-out;
            gap: 1rem;
        }
        .carousel-slide {
            flex: 0 0 calc(50% - 0.5rem);
            aspect-ratio: 1;
        }
        @media (min-width: 640px) {
            .carousel-slide {
                flex: 0 0 calc(33.333% - 0.667rem);
            }
        }
        @media (min-width: 768px) {
            .carousel-slide {
                flex: 0 0 calc(25% - 0.75rem);
            }
        }
        @media (min-width: 1024px) {
            .carousel-slide {
                flex: 0 0 calc(20% - 0.8rem);
            }
        }
        .carousel-btn {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            z-index: 10;
            background: rgba(33, 40, 66, 0.9);
            color: white;
            border: none;
            width: 3rem;
            height: 3rem;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s, transform 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .carousel-btn:hover {
            background: rgba(33, 40, 66, 1);
            transform: translateY(-50%) scale(1.1);
        }
        .carousel-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
        .carousel-btn-prev { left: 0.5rem; }
        .carousel-btn-next { right: 0.5rem; }
        .carousel-dots {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            margin-top: 1.5rem;
        }
        .carousel-dot {
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 50%;
            background: rgba(33, 40, 66, 0.3);
            border: none;
            cursor: pointer;
            transition: background 0.2s, transform 0.2s;
        }
        .carousel-dot.active {
            background: rgba(33, 40, 66, 1);
            transform: scale(1.3);
        }
        .note-card, .dish-card, .car-card {
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        .note-card:hover, .dish-card:hover, .car-card:hover {
            transform: scale(1.02);
        }
    </style>
</head>
"@
        
        # Combine proper head with body content
        $fixedContent = $properHead + $bodyContent
        
        # Fix any remaining /hobbies.html links to /en/hobbies/
        $fixedContent = $fixedContent -replace 'href="/hobbies\.html', 'href="/en/hobbies/'
        $fixedContent = $fixedContent -replace 'href="/en/hobbies/whispers\.html"', 'href="/en/hobbies/whispers"'
        $fixedContent = $fixedContent -replace 'href="/en/hobbies/cooking\.html"', 'href="/en/hobbies/cooking"'
        $fixedContent = $fixedContent -replace 'href="/en/hobbies/car\.html"', 'href="/en/hobbies/car"'
        
        # Write fixed file
        Set-Content -Path $filePath -Value $fixedContent -NoNewline
        Write-Host "✅ Fixed $page.html"
    } else {
        Write-Host "❌ Could not extract body from $page.html"
    }
}

Write-Host "`nAll hobby pages fixed!"
