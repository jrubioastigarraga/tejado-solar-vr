# Genera los iconos de la app (PNG) sin dependencias externas.
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$res  = Join-Path $root 'app\src\main\res'

$sizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }

function New-Icon([int]$size, [string]$path, [bool]$round) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 16, 30, 46),
        [System.Drawing.Color]::FromArgb(255, 6, 12, 20),
        55.0)

    if ($round) {
        $g.FillEllipse($bg, 0, 0, $size, $size)
    } else {
        $r = [Math]::Max(6, [int]($size * 0.22))
        $p = New-Object System.Drawing.Drawing2D.GraphicsPath
        $p.AddArc(0, 0, $r, $r, 180, 90)
        $p.AddArc($size - $r, 0, $r, $r, 270, 90)
        $p.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
        $p.AddArc(0, $size - $r, $r, $r, 90, 90)
        $p.CloseFigure()
        $g.FillPath($bg, $p)
    }

    # sol
    $sunR = $size * 0.115
    $sunX = $size * 0.71 - $sunR
    $sunY = $size * 0.27 - $sunR
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 255, 194, 71))
    $g.FillEllipse($glow, $sunX - $sunR * 0.7, $sunY - $sunR * 0.7, ($sunR * 2.7), ($sunR * 2.7))
    $sun = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 194, 71))
    $g.FillEllipse($sun, $sunX, $sunY, $sunR * 2, $sunR * 2)

    # panel fotovoltaico inclinado
    $cx = $size * 0.48
    $cy = $size * 0.64
    $w = $size * 0.62
    $h = $size * 0.34
    $angle = -11.0

    $state = $g.Save()
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform($angle)

    $panelRect = New-Object System.Drawing.RectangleF((-($w / 2)), (-($h / 2)), $w, $h)
    $panelFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 13, 38, 60))
    $g.FillRectangle($panelFill, $panelRect)

    $edge = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 190, 225, 255), [Math]::Max(1.2, $size * 0.022))
    $edge.LineJoin = 'Round'
    $g.DrawRectangle($edge, $panelRect.X, $panelRect.Y, $panelRect.Width, $panelRect.Height)

    $grid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(170, 90, 160, 210), [Math]::Max(0.8, $size * 0.012))
    for ($i = 1; $i -lt 4; $i++) {
        $x = -($w / 2) + ($w / 4) * $i
        $g.DrawLine($grid, $x, -($h / 2), $x, ($h / 2))
    }
    for ($i = 1; $i -lt 2; $i++) {
        $y = -($h / 2) + ($h / 2) * $i
        $g.DrawLine($grid, -($w / 2), $y, ($w / 2), $y)
    }
    $g.Restore($state)

    # suelo / tejado
    $roof = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(210, 70, 217, 155), [Math]::Max(1.4, $size * 0.02))
    $g.DrawLine($roof, $size * 0.16, $size * 0.82, $size * 0.84, $size * 0.82)

    $sun.Dispose(); $glow.Dispose(); $panelFill.Dispose(); $edge.Dispose(); $grid.Dispose(); $roof.Dispose(); $bg.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

foreach ($k in $sizes.Keys) {
    $dir = Join-Path $res "mipmap-$k"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    New-Icon $sizes[$k] (Join-Path $dir 'ic_launcher.png') $false
    New-Icon $sizes[$k] (Join-Path $dir 'ic_launcher_round.png') $true
    Write-Host "mipmap-$k -> $($sizes[$k])px"
}
