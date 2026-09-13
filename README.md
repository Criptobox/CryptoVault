# 🔐 CryptoVault — Dashboard multi-red de carteras

Dashboard **no custodial** para tu wallet: todos tus tokens y NFTs en **23 redes EVM**, con centro de rescate de fondos, revocación de aprobaciones, alertas de precio y notificaciones.

> ✅ Tus claves privadas **nunca salen de tu cartera**. Todas las transacciones las firmas tú.

---

## ✨ Funciones

| Función | Descripción |
|---|---|
| 🔗 **Multi-wallet** | MetaMask, Rabby, Trust, Coinbase, OKX, Brave, Safe (multisig) vía EIP-6963 + WalletConnect (QR móvil) con Project ID propio |
| 🌐 **23 redes con logos** | Ethereum, BSC, Polygon, Arbitrum, Base, Optimism, Avalanche, opBNB, Fantom, zkSync, Linea, Scroll, Gnosis, Mantle, Cronos, Moonbeam, Canto, Core, Kava, Celo, Polygon zkEVM, Unichain, Sei |
| 🪙 **Todos los tokens** | Lista integrada de tokens principales + **descubrimiento automático de TODOS tus tokens** (con API key) + importar cualquier ERC-20 por dirección |
| 💰 **Precios en vivo** | CoinGecko (gratis, sin clave) para nativos y ERC-20 |
| 🏦 **Centro de Rescate** | 4 módulos: **escáner de fondos rescatables en las 23 redes** · revocar aprobaciones · retiro manual de contratos viejos (ABI) · rescate masivo de polvo en 1 sola transacción (Multicall3) |
| 🪂 **Radar de Airdrops** | **Escanea y verifica airdrops accesibles con tu cartera en TODAS las redes soportadas** (Blockscout público + nonce RPC, sin API key): los clasifica en *Reclamable ahora*, *Pendiente de reclamo*, *Cerca de reclamar*, *Acumulando* o *Finalizado* según tu actividad on-chain real (transacciones, antigüedad, protocolos usados, balances). Incluye **verificador de CUALQUIER contrato de claim** con simulación segura y **reclamo en 1 clic** |
| 🖼️ **Galería NFT** | Detecta tus ERC-721 en todas las redes y enlaza directamente a **OpenSea, Blur, Magic Eden, OKX y Element** para ver precios y vender |
| 🔔 **Notificaciones** | Alertas de precio (sube/baja), estado de transacciones y avisos de seguridad — con notificaciones del sistema |
| 💡 **Recomendaciones** | Puntuación de salud de cartera + consejos dinámicos según tus aprobaciones, polvo y concentración |
| 📱 **PWA instalable** | Windows, Android (APK), iOS e incluso escritorio Linux — ver guía abajo |

---

## 🆕 Novedades v5 — Escáner de fondos rescatables + optimización

| # | Novedad | Dónde |
|---|---------|-------|
| 1 | 🎯 **Escáner de Fondos Rescatables** — pega CUALQUIER dirección (o usa tu cartera) y un clic detecta automáticamente fondos atrapados en contratos viejos en **las 23 redes**: farms MasterChef deprecados, staking cerrado, presales, vesting, vaults reemplazados… ideal para dApps que actualizaron su web y ya no exponen la versión vieja | Rescate → **Fondos** |
| 2 | 🔓 **Botón RESCATAR por cada fondo** — la app encuentra la función de retiro real (withdraw/exit/emergencyWithdraw(pid)/redeem/unstake/claim…), la **simula on-chain** y solo muestra el botón si el rescate funcionaría hoy. Modo lectura = ves todo, el botón se activa al conectar la cartera firmante | Rescate → Fondos |
| 3 | 🧠 **Detección sin configuración** — funciona sin API key: Blockscout público (13 redes) + nonce RPC para el resto; con tu API key de Etherscan el historial es completo. Extrae el `pid` de tus deposits viejos desde el historial para sondear pools exactas de MasterChef | Automático |
| 4 | 🪂 **Airdrops en TODAS las redes** — el radar ahora escanea las 23 redes soportadas (antes 9-16): Blockscout + Etherscan + nonce RPC como último recurso, ninguna cadena se queda fuera | Radar de Airdrops |
| 5 | 🆕 **21 airdrops** — añadidos Morpho, megaETH, Linea·Ecosistema, Scroll·Sessions con criterios evaluables; más redes en los criterios de OpenSea y MetaMask | Radar de Airdrops |
| 6 | ⚡ **Optimización de rendimiento** — bundles divididos con carga diferida (gráfico, radar, NFTs, rescate, gas, buscador y diálogos cargan solo cuando toca), `memo` contra re-renders en cascada y la escena aurora redibujada sin `filter: blur(90px)` animado (el mayor coste de GPU) → primera pintura y scroll mucho más fluidos, sobre todo en móvil | Global |
| 7 | 💾 **Escaneo guardado 6 h** — los resultados del escáner de fondos se cachean por dirección; al volver se muestran al instante con badge «escaneo guardado» | Rescate → Fondos |

## 🆕 Novedades v4 — WalletConnect QR

| # | Novedad | Dónde |
|---|---------|-------|
| 1 | 📱 **Conexión por QR (WalletConnect v2)** — conecta 400+ carteras móviles escaneando un QR, con modal oficial en tema oscuro | Fila «WalletConnect · QR» en el diálogo de conexión |
| 2 | 🧾 **Setup guiado del Project ID** — diálogo paso a paso con enlace directo a cloud.walletconnect.com; se guarda solo en tu dispositivo y auto-conecta al guardar | Fila WalletConnect → 1ª vez |
| 3 | 🔗 **Deep-links móviles + 23 redes** — la sesión QR soporta abrir la cartera por enlace en el móvil y todas las cadenas del dashboard | Automático |

## 🆕 Novedades v3 — las 16 mejoras

| # | Mejora | Dónde |
|---|--------|-------|
| 1 | 👁 **Modo solo lectura** — pega cualquier dirección y analízala sin conectar nada (cero riesgo, cero firmas) | Botón «Conectar» → *Ver en modo lectura* · icono de carteras vigiladas |
| 2 | 🛡 **Gestor de aprobaciones** — ve todas tus approvals ERC-20 (con etiqueta y riesgo del spender) y **revoca en 1 clic** con simulación previa | Rescate → Aprobaciones |
| 3 | 🧪 **Simulación de transacciones** — ANTES de firmar, la app simula on-chain y te muestra en lenguaje claro qué hará la tx, coste de gas y advertencias de seguridad | Automático en: revocar, rescate masivo, contratos viejos y reclamos |
| 4 | 🧹 **Filtro anti-spam** — oculta tokens/NFTs trampa (enlaces, «claim», «airdrop»…) con heurística + lista de bloqueo propia por token | Ajustes → Filtro anti-spam (botones ✕ en filas para marcar) |
| 5 | 📈 **Gráfico del portafolio** — evolución 24 h / 7 d / 30 d con **PnL** (ganancia/pérdida coloreada) | Tarjeta «Evolución del portafolio» |
| 6 | ⛽ **Gas Tracker en vivo** — gwei por red, coste de una transferencia y aviso «buen momento para transaccionar» cuando el gas de ETH está bajo | Tarjeta «Gas en vivo» + Ajustes |
| 7 | 👥 **Multi-dirección** — vigila varias wallets, cambia entre ellas con 1 clic y **suma todas en el total** | Icono de carteras vigiladas (agenda) |
| 8 | 💱 **Selector de moneda** — USD · EUR · MXN · ARS · COP en toda la app (precios, alertas, histórico) | Header + Ajustes |
| 9 | 📜 **Airdrops históricos** — pestaña «Finalizados» con los que ya cerraron (ARB, OP, UNI, ENS, zkSync…) y tu score histórico | Radar → Finalizados |
| 10 | 🎯 **Score de elegibilidad** — anillo de progreso 0-100 % por airdrop con checklist de criterios y pistas de cómo calificar | Radar → Verificar |
| 11 | 🔔 **Alertas de nuevos airdrops** — notificación individual cuando un airdrop sube de estado (ej. pasa a «Reclamable») o aparece uno nuevo | Automático en cada escaneo |
| 12 | ☀️ **Modo claro/oscuro** — tema premium «AURUM IVORY» claro y «OBSIDIAN» oscuro, con 1 clic | Icono sol/luna del header |
| 13 | 🔎 **Buscador global** — Ctrl/⌘+K: busca tokens, NFTs, airdrops, redes, carteras y acciones al instante | Lupa del header o Ctrl+K |
| 14 | 📤 **Exportar CSV** — descarga tu portafolio completo o la tabla de tokens para Excel/Sheets | Botón «Exportar CSV» (hero y tokens) |
| 15 | 🌐 **Multi-idioma** — Español ⇄ English con un clic (más de 300 textos traducidos) | Botón ES/EN del header |
| 16 | ⬇️ **Botón «Instalar app»** — banner nativo de instalación PWA + instrucciones para iOS | Header (aparece cuando tu navegador lo permite) |

---

## 🪂 Radar de Airdrops (nuevo)

El radar escanea tu actividad on-chain real y puntúa 17 airdrops curados (OP, EIGEN, ENA, SEA, MASK, Base, Unichain + 10 históricos informativos) contra criterios verificables: transacciones por red, antigüedad de cartera, interacción con protocolos (Seaport/OpenSea, router de MetaMask, DEXs…) y balances reales del portafolio.

- **Sin API key obligatoria**: usa las instancias públicas de Blockscout V2; con API key de Etherscan añade antigüedad exacta y más redes.
- **Estados automáticos**: 🎁 Reclamable ahora · ⏳ Pendiente de reclamo · 🔥 Cerca de reclamar (50–99 %) · 📈 Acumulando · ✔️ Finalizado, con anillo de progreso por airdrop.
- **Verificador universal**: pega el contrato de claim de cualquier airdrop y la app sondea on-chain (`claimable(address)`, `isClaimed`, saldo del contrato…) y **simula el reclamo sin firmar nada**; si es viable, aparece el botón de **reclamar en 1 clic** y el airdrop se guarda en tu radar.
- **Notificaciones**: al terminar cada escaneo te avisamos de cuántos reclamables, pendientes y «cerca de reclamar» tienes.
- **Seguridad**: todo el escaneo es solo lectura; ninguna transacción se firma sin tu revisión. Reclama siempre desde el sitio oficial.

---

## 📱 Conectar por QR — WalletConnect (nuevo en v4)

Además de MetaMask, Rabby, Coinbase Wallet y Safe (extensión de navegador), ahora puedes **conectar cualquier cartera de móvil escaneando un código QR** con WalletConnect v2: MetaMask Mobile, Trust Wallet, OKX Wallet, Bitget, Binance Wallet, Zerion, Phantom EVM y más de 400 carteras.

**Cómo conectar por QR (1 minuto):**

1. Abre la app y pulsa **«Conectar Cartera»**.
2. Toca la fila azul **WalletConnect · QR** (fijada arriba).
3. La primera vez la app te pedirá un **Project ID gratuito**: crea una cuenta en <https://cloud.walletconnect.com> (plan Free, sin tarjeta), copia el *Project ID* de tu proyecto y pégalo en el diálogo. Se guarda **solo en tu dispositivo**.
4. Al guardar, la app se reconfigura sola y **abre el QR al instante**: escanéalo con tu cartera (en MetaMask: *Cartera → Escanear código QR*) y confirma el emparejamiento.
5. Las siguientes veces el QR abre directamente, sin repetir la configuración.

**Detalles útiles:**

- El modal oficial de WalletConnect se muestra en **tema oscuro** con la marca de la app; también permite abrir la cartera por **deep-link** si estás en el móvil.
- La conexión soporta **las 23 redes** del dashboard: la cartera aprobará las cadenas que use al emparejar.
- Si el Project ID es inválido, el relay responde «Project not found»: vuelve a Ajustes y revísalo.
- ¿Sin Project ID y sin extensiones? Recuerda que siempre puedes usar el **modo lectura** pegando la dirección.

---

## 🚀 Publicar gratis en GitHub Pages (recomendado)

1. **Crea un repositorio** en GitHub (p. ej. `cryptovault`) y sube este proyecto:

   ```bash
   git init
   git add .
   git commit -m "CryptoVault dashboard"
   git remote add origin https://github.com/TU_USUARIO/cryptovault.git
   git branch -M main
   git push -u origin main
   ```

2. **Activa GitHub Pages** en tu repo:
   - `Settings` → `Pages` → `Source`: **GitHub Actions**

3. **Listo.** El workflow `.github/workflows/deploy.yml` compila la versión estática y la publica automáticamente en cada push:
   - `https://TU_USUARIO.github.io/cryptovault/`

> 💡 Si usas **dominio propio**, edita `deploy.yml` y cambia `NEXT_PUBLIC_BASE_PATH` a cadena vacía.

---

## 📲 Convertir la PWA en APK (Android)

Opción A — **PWABuilder** (sin código):
1. Abre <https://www.pwabuilder.com> y pega la URL de tu GitHub Pages
2. Pincha `Android package` → descarga el APK/AAB firmado
3. Publica en Google Play o reparte el APK directamente

Opción B — **Bubblewrap** (CLI oficial de Google):

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://TU_USUARIO.github.io/cryptovault/manifest.json
bubblewrap build   # genera app-release-signed.apk
```

## 🪟 Instalar en Windows (sin tienda)

1. Abre la URL en **Edge** o **Chrome**
2. En la barra de direcciones pulsa el icono **Instalar** (o menú → `Aplicaciones` → `Instalar este sitio como aplicación`)
3. La app se instala con su propio icono y ventana — como una app nativa

> 🍎 En iOS/Mac: Safari → Compartir → *Añadir a inicio*

---

## 🔑 API keys (opcionales pero recomendadas)

| Clave | Para qué | Dónde obtenerla |
|---|---|---|
| **Etherscan V2** (1 clave = todas las redes) | Descubrir TODOS tus tokens, NFTs y aprobaciones | <https://etherscan.io/apis> (gratis) |
| **WalletConnect Project ID** | Conectar carteras de móvil **por QR** (fila WalletConnect del diálogo de conexión) | <https://cloud.walletconnect.com> (gratis, sin tarjeta) |

Ambas se guardan **solo en tu dispositivo** (localStorage). Sin ellas la app funciona con: tokens principales, saldo nativo, precios, rescate de contratos (pegando ABI) y barre-polvo.

---

## 🛠️ Desarrollo

```bash
bun install
bun run dev    # http://localhost:3000
bun run lint
```

Build estático para Pages (lo que hace el workflow):

```bash
NEXT_PUBLIC_OUTPUT=export NEXT_PUBLIC_BASE_PATH=/cryptovault bunx next build
# salida en ./out
```

### Arquitectura

```
src/
├── app/                    # Página única (dashboard)
├── config/
│   ├── chains.ts           # 23 redes: RPC, explorers, marketplaces, logos
│   ├── tokens.ts           # Tokens conocidos por red (con CoinGecko id)
│   └── spenders.ts         # Gastos conocidos (routers, Seaport…)
├── hooks/
│   ├── usePortfolio.ts     # Saldos multicall + precios
│   ├── useNfts.ts          # Detección ERC-721 + metadata
│   ├── useApprovals.ts     # Escaneo de aprobaciones + revocación
│   ├── usePriceAlerts.ts   # Vigilancia de alertas de precio
│   └── useTxNotifications.ts
├── lib/api/                # CoinGecko + Etherscan V2
└── components/dashboard/   # UI: portafolio, tokens, NFTs, rescate…
```

### RPCs

La app usa RPCs públicos (con respaldo de publicnode.com) leyendo directamente de la blockchain. Para más velocidad puedes cambiar los RPCs en `src/config/chains.ts`.

---

## ⚠️ Aviso

Software educativo "tal cual". Verifica siempre cada transacción en tu cartera antes de firmar. Ningún contrato es seguro al 100%: la pestaña «Contratos viejos» solo prepara llamadas; tu cartera las aprueba.
