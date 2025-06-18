
---

# ZX Spectrum Laser Basic Sprite Editor

Programming games for the ZX Spectrum is quite a difficult task, as it requires very serious work with Z80 Assembler.

Fortunately, there is a tool named **Laser Basic**, which is an extension to the standard ZX Spectrum 48k BASIC and allows for easy work with sprites.

But in order to work with sprites, you need to create them first, right? **Laser Basic** comes with its own Sprite Generator, a standalone program for the ZX Spectrum, which (unfortunately) is very heavy and difficult to work with.

## What is ZX Spectrum Laser Basic Sprite Editor?

A modern, web-based visual editor for creating and managing software sprites for the ZX Spectrum, specifically for use with **Laser Basic** in its `OPTION 2` sprite format. (`OPTION 2` means that the sprites can be used in Laser Basic itself, but not in the Sprite Generator.)

This tool is built with pure, vanilla HTML, CSS, and JavaScript, requiring no external dependencies. It runs entirely in your web browser.

## Features

-   **Dual Editing Modes**: Seamlessly switch between **Pixel Mode** for drawing and **Attribute Mode** for coloring.
-   **WYSIWYG Canvas**: The editor canvas accurately reflects the ZX Spectrum's color palette, including `BRIGHT` and `FLASH` attributes.
-   **Full Attribute Control**: Individually set `INK`, `PAPER`, `BRIGHT`, and `FLASH` for each 8x8 character cell within a sprite.
-   **Complete Sprite Set Management**:
    -   Add new, empty sprites to your collection.
    -   Delete sprites you no longer need.
    -   Re-order sprites within the set using "Move Up" and "Move Down" controls.
-   **Authentic File Format Support**:
    -   **Load**: Open standard `.TAP` files and choose from a list of data blocks found within the file.
    -   **Save**: Export your entire sprite collection into a single, valid `.TAP` file, compatible with Laser Basic's `OPTION 2` format.
-   **Modern User Interface**:
    -   A sleek, responsive design that works on all modern browsers.
    -   Includes a "sexy" theme switcher to toggle between **Light** and **Dark** modes. Your preference is saved locally.
-   **Intuitive Drawing Tools**:
    -   Click to toggle a single pixel.
    -   Click and drag to draw continuous lines.

## How to Use

1.  **Running the Editor**: Simply open the `index.html` file in your web browser (e.g., Chrome, Firefox, Edge).
2.  **Creating Sprites**:
    -   Use the **"Add New Sprite"** button to create a blank sprite.
    -   Select a sprite from the list on the left to begin editing.
    -   Set the desired `Width` and `Height` (in characters) and click **"Apply Size"**.
    -   In **Pixel Mode**, click and drag on the main canvas to draw your sprite.
3.  **Coloring Sprites**:
    -   Switch to **Attribute Mode**.
    -   Click on an 8x8 character block on the canvas to select it for editing.
    -   Use the **Attribute Editor** panel on the right to set its `INK`, `PAPER`, `BRIGHT`, and `FLASH` properties. The changes will appear live on the canvas.
4.  **Loading and Saving**:
    -   **To Load**: Click **"Load from .TAP"** and select a `.TAP` file from your computer. If multiple data blocks are found, a modal window will appear, allowing you to choose which one to load.
    -   **To Save**: Click **"Save to .TAP"**. You will be prompted to enter a filename (e.g., "MYSPRITES"), and a valid `.TAP` file will be downloaded. The filename will include the sprite block's starting address, which is required for loading. You will also be shown the BASIC commands needed to load the sprites.
5.  **Undo/Redo Functionality**:
    -   You may use **Ctrl+Z** and **Ctrl+Shift+Z**. This functionality works on a "per sprite basis"—i.e., each sprite has its own undo/redo stack.

## Example Working Session

Here I will describe a minimal working session with the [Fuse emulator](https://fuse-emulator.sourceforge.net/) and [Laser Basic](https://spectrumcomputing.co.uk/entry/8327/ZX-Spectrum/Laser_Basic).

1.  Load the Sprite Editor and draw some pixels on the default empty sprite.
2.  Click on the `Attribute Mode` button and set some attributes.
3.  Press `Save to .TAP` and download the `.TAP` file. If you use the default settings for a single sprite, the filename will be `sprites_56534.tap`, and the command for loading will be:

    ```
    CLEAR 56533: LOAD "sprites" CODE 56534: .POKE 62464, 56534
    ```

4.  Load Laser Basic in Fuse. Select `1.... EXECUTE LASER BASIC`. You are now ready to load the sprites and create a program.
5.  Change the tape in Fuse: select `Media/Tape/Open` in the Fuse menu and load the file with your sprites.
6.  Execute the commands from step 3.
7.  To see your sprite in Laser Basic, execute the following commands:

    ```
    .COL=0:.ROW=0
    .SPN=1:.PTBL
    ```

If everything is executed correctly, you will see your sprite in the top-left corner of the screen.