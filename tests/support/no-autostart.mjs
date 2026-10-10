// Project: Git Architecture Diagram | Test support: import server.mjs without opening its production listener.
process.env.GIT_ARCHITECTURE_DIAGRAM_AUTOSTART = '0'; // Import this module before server.mjs; ES modules evaluate imports in source order.
process.env.GAD_CACHE_DIR ??= 'off'; // Tests keep saved analyses in memory unless a test chooses a folder; nothing is written into the checkout.
