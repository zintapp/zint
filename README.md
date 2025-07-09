# Zint

A modern terminal emulator with the ability to escape to graphical UIs.

## About

Zint is a terminal emulator that allows seamless integration between command-line interfaces and graphical components. It enables developers to build and use terminal applications that can launch rich graphical interfaces when needed, providing the best of both worlds.

## Getting Started

### Download a prebuilt version

Prebuilt packages for MacOS (apple silicon) are available at [www.zint.app/downloads](https://www.zint.app/downloads)

### Build from source

1. Clone this repository

2. Install dependencies:
```bash
yarn install
```

3. Build the internal components (by default Zint comes with one internal component (default) that guesses the data type of the stdin stream and creates an iframe with the appropriate type). We need to build it and symlink it to the appropriate place where the electron app will look for it:
```bash
yarn buildinternalcomponents
yarn linkinternalcomponents
```

4. Start the application:
```bash
yarn electron
```

## License

All rights reserved.

## Author

Guillaume de Cagny <hello@gdc.dev>
