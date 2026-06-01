# Popup Spec

## Container
- width: `360px`
- background: `#FFFFFF`
- border-radius: `24px`
- shadow: `0 12px 32px rgba(3, 32, 72, 0.12)`
- padding: `20px 20px 18px 20px`

## Top Row
- layout: horizontal
- gap: `12px`
- margin-bottom: `14px`
- mascot size: `44x44px`
- mascot role: decorative only
- chip text: `Full page`
- chip height: `40px`
- chip padding-x: `16px`
- chip radius: `999px`
- chip background: `#EAF3FF`
- chip text color: `#032048`
- chip font: `14px / 600`

## Action Rows
- count: `2`
- labels:
  - `Capture as PDF`
  - `Capture as PNG`
- equal hierarchy
- height: `72px`
- radius: `18px`
- padding-x: `18px`
- gap between rows: `12px`

Internal row structure:
- left file icon: `40px`
- gap icon to label: `14px`
- right chevron: `20px`

## States
### Default
- background: `#FFFFFF`
- border: `1.5px solid #DCE8FF`
- shadow: `0 4px 14px rgba(3, 32, 72, 0.06)`
- chevron: `#5A6D8F`

### Hover
- background: `#F4F8FF`
- border: `1.5px solid #8FC0FF`
- shadow: `0 8px 20px rgba(3, 32, 72, 0.10)`
- chevron: `#0372F9`
- optional transform: `translateY(-1px)`

### Pressed
- background: `#EAF3FF`
- border: `1.5px solid #5CA6FF`
- shadow: `0 2px 8px rgba(3, 32, 72, 0.08)`

### Focus
- base same as Default
- add ring: `0 0 0 3px rgba(3, 114, 249, 0.22)`

## Restrictions
- no title header
- no settings icon
- no helper subtitles in final compact version
- no primary/secondary hierarchy between PDF and PNG rows
- mascot must not compete with actions
