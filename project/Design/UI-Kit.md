# Extension UI Kit

Source basis:
- brand icon / etalon camera mark
- popup design direction developed in the thread

## 1. Brand Character
Observed directly from the icon:
- friendly
- geometric
- soft-rounded
- high-contrast
- clean, minimal, utility-first

Implication for UI:
- avoid sharp corners
- avoid thin fragile outlines
- keep interactions clean and direct
- use blue as the main action color and navy as the main text color

## 2. Core Brand Colors
These are working UI values sampled and normalized from the icon system.

- Brand Blue: `#0372F9`
- Brand Blue Hover: `#0069FC`
- Brand Blue Soft: `#F4F8FF`
- Brand Blue Pressed: `#EAF3FF`
- Deep Navy: `#032048`
- Muted Navy: `#5A6D8F`
- White: `#FFFFFF`
- Border Soft: `#DCE8FF`
- Border Hover: `#8FC0FF`
- Border Pressed: `#5CA6FF`

## 3. Radius System
Recommended rounded scale based on the icon geometry.

- radius-sm: `8px`
- radius-md: `12px`
- radius-lg: `16px`
- radius-xl: `20px`
- radius-2xl: `24px`
- radius-pill: `999px`

Usage:
- buttons / inputs: `8-12px`
- action rows: `18px`
- popup container: `24px`
- chips: `999px`

## 4. Popup Pattern
Product direction:
- no title header
- no settings icon
- no top protrusion
- small mascot as decorative accent only
- small status chip: `Full page`
- two equal action rows:
  - `Capture as PDF`
  - `Capture as PNG`

## 5. Action Row Behavior
Default:
- white background
- soft blue border
- navy text
- muted chevron
- subtle shadow

Hover:
- very light blue background
- stronger blue border
- blue chevron
- slightly stronger shadow

Pressed:
- pale blue background
- stronger border
- reduced shadow

Focus:
- accessible blue focus ring

## 6. What Is Not Defined By The Icon Alone
These need validation on real product screens:
- typography system
- spacing scale beyond popup usage
- shadows across the full product
- error/success/warning colors
- motion principles
- empty states / onboarding screens
