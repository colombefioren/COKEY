/*
 * Pixel-art icons.
 *
 * The line icons in Icons.tsx are the right tool for dense table rows and
 * inline affordances. These are for the places that carry the desktop metaphor:
 * navigation, window title bars, empty states — anything that should feel like
 * a 16-colour-era sprite rather than a vector.
 *
 * Each icon is authored as ASCII art on a 12x12 grid and rendered as one
 * `<rect>` per lit pixel, with `shape-rendering: crispEdges` so the grid stays
 * square at any size. Writing them this way is the whole point: a folder you can
 * read in the source is one you can edit without a design tool.
 *
 *   `#`  solid        `+`  shaded (55% opacity)        `.`  transparent
 *
 * They take `currentColor`, so one icon works on a pastel title bar and on a
 * dark night-sky panel without a second asset.
 */

import type { ReactNode } from "react";

export interface PixelIconProps {
  /** Rendered size in pixels. The grid is 12x12, so 12 and 24 stay sharp. */
  size?: number;
  className?: string;
  /** Accessible name. Omit for decorative use next to visible text. */
  label?: string;
}

/** Render an ASCII grid as one rect per lit pixel. */
function PixelArt({
  rows,
  size = 16,
  className,
  label,
}: PixelIconProps & { rows: string[] }): ReactNode {
  const grid = rows.length;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rows.flatMap((row, y) =>
        row.split("").map((cell, x) => {
          if (cell === ".") return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              opacity={cell === "+" ? 0.55 : 1}
            />
          );
        }),
      )}
    </svg>
  );
}

/** A folder, for anything that holds other things. */
export function PixelFolder(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "............",
        ".####.......",
        "#++++###....",
        "#++++++++##.",
        "#++++++++++#",
        "#++++++++++#",
        "#++++++++++#",
        "#++++++++++#",
        ".##########.",
        "............",
        "............",
        "............",
      ]}
    />
  );
}

/** A wall clock, for history, latency and anything time-shaped. */
export function PixelClock(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "...####.....",
        ".##....##...",
        ".#......#...",
        "#....#...#..",
        "#....#...#..",
        "#....##..#..",
        "#........#..",
        ".#......#...",
        ".##....##...",
        "...####.....",
        "............",
        "............",
      ]}
    />
  );
}

/** A star, for rankings and for rewards. */
export function PixelStar(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        ".....++.....",
        ".....++.....",
        "....####....",
        "+++######+++",
        ".##########.",
        "..########..",
        "..########..",
        ".###.##.###.",
        ".##.....##..",
        "##.......##.",
        "............",
        "............",
      ]}
    />
  );
}

/** A floppy disk, for saving and exporting. */
export function PixelFloppy(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "############",
        "#++++++++++#",
        "#+########+#",
        "#+########+#",
        "#++++++++++#",
        "#++++++++++#",
        "#++####++++#",
        "#++#..#++++#",
        "#++#..#++++#",
        "#++####++++#",
        "############",
        "............",
      ]}
    />
  );
}

/** A crescent moon, for the dark theme and for quiet hours. */
export function PixelMoon(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "...###......",
        "..##........",
        ".##.........",
        "##..........",
        "##..........",
        "##..........",
        "##..........",
        "##..........",
        ".##.........",
        "..##........",
        "...###......",
        "............",
      ]}
    />
  );
}

/** A key, for credentials and for the gateway's own API keys. */
export function PixelKey(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "...####.....",
        "..##..##....",
        ".##....##...",
        ".##....##...",
        "..##..##....",
        "...####.....",
        "....##......",
        "....##......",
        "....###.....",
        "....##......",
        "....###.....",
        "....##......",
      ]}
    />
  );
}

/** A bar chart, for usage and statistics. */
export function PixelChart(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "............",
        ".........##.",
        ".........##.",
        "......##.##.",
        "......##.##.",
        "..##..##.##.",
        "..##..##.##.",
        "..##..##.##.",
        "###########.",
        "###########.",
        "............",
        "............",
      ]}
    />
  );
}

/** A heart, for the parts of the app that are just for the user. */
export function PixelHeart(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        ".##....##...",
        "####..####..",
        "###########.",
        "###########.",
        "###########.",
        ".#########..",
        "..#######...",
        "...#####....",
        "....###.....",
        ".....#......",
        "............",
        "............",
      ]}
    />
  );
}

/** An info plaque, for notes and guidance. */
export function PixelInfo(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "....####....",
        "..##....##..",
        ".#........#.",
        "#..........#",
        "#....##....#",
        "#....##....#",
        "#..........#",
        "#....##....#",
        "#....##....#",
        ".#........#.",
        "..##....##..",
        "....####....",
      ]}
    />
  );
}

/** A server rack, for providers. */
export function PixelServer(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "..########..",
        ".#........#.",
        ".#..####..#.",
        ".##########.",
        "............",
        "..########..",
        ".#........#.",
        ".#..####..#.",
        ".##########.",
        "............",
        "............",
        "............",
      ]}
    />
  );
}

/** A padlock, for locked settings and for the vault. */
export function PixelLock(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "....####....",
        "...#....#...",
        "...#....#...",
        "..########..",
        "..#......#..",
        "..#..##..#..",
        "..#..##..#..",
        "..#......#..",
        "..########..",
        "............",
        "............",
        "............",
      ]}
    />
  );
}

/** A scroll, for terms and documentation. */
export function PixelScroll(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        ".#######....",
        ".#+++++#....",
        ".#+++++#....",
        ".#+++++####.",
        ".#+++++#+++#",
        ".#+++++++++#",
        ".#+++++#+++#",
        ".#+++++++++#",
        ".#+++++#++++",
        ".#+++++#....",
        ".###########",
        "............",
      ]}
    />
  );
}

/** A wrench, for settings and for the doctor command. */
export function PixelWrench(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "...####.....",
        "..##..##....",
        "..##..##....",
        "...####.....",
        "....##......",
        "...##.......",
        "..##........",
        ".##.........",
        "##..........",
        "##..........",
        "#...........",
        "............",
      ]}
    />
  );
}

/** A plug, for connecting a provider. */
export function PixelPlug(props: PixelIconProps) {
  return (
    <PixelArt
      {...props}
      rows={[
        "...#..#.....",
        "...#..#.....",
        "..######....",
        "..######....",
        "...####.....",
        "....##......",
        "....##......",
        "....##....##",
        "....##....##",
        "............",
        "............",
        "............",
      ]}
    />
  );
}
