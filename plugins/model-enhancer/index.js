// GENERATED FILE - DO NOT EDIT DIRECTLY.
// Edit plugins/model-enhancer/src/*.js or assets/, then run `npm run sync`.

(function registerModelEnhancerMod(win, doc) {
  const __MODEL_ENHANCER_ICONS__ = {"anthropic":"<svg fill=\"currentColor\" fill-rule=\"evenodd\" height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Anthropic</title><path d=\"M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z\"></path></svg>","deepseek":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>DeepSeek</title><path d=\"M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z\" fill=\"#4D6BFE\"></path></svg>","gemini":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Gemini</title><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"#3186FF\"></path><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"url(#lobe-icons-gemini-fill-0)\"></path><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"url(#lobe-icons-gemini-fill-1)\"></path><path d=\"M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z\" fill=\"url(#lobe-icons-gemini-fill-2)\"></path><defs><linearGradient gradientUnits=\"userSpaceOnUse\" id=\"lobe-icons-gemini-fill-0\" x1=\"7\" x2=\"11\" y1=\"15.5\" y2=\"12\"><stop stop-color=\"#08B962\"></stop><stop offset=\"1\" stop-color=\"#08B962\" stop-opacity=\"0\"></stop></linearGradient><linearGradient gradientUnits=\"userSpaceOnUse\" id=\"lobe-icons-gemini-fill-1\" x1=\"8\" x2=\"11.5\" y1=\"5.5\" y2=\"11\"><stop stop-color=\"#F94543\"></stop><stop offset=\"1\" stop-color=\"#F94543\" stop-opacity=\"0\"></stop></linearGradient><linearGradient gradientUnits=\"userSpaceOnUse\" id=\"lobe-icons-gemini-fill-2\" x1=\"3.5\" x2=\"17.5\" y1=\"13.5\" y2=\"12\"><stop stop-color=\"#FABC12\"></stop><stop offset=\".46\" stop-color=\"#FABC12\" stop-opacity=\"0\"></stop></linearGradient></defs></svg>","grok":"<svg fill=\"currentColor\" fill-rule=\"evenodd\" height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Grok</title><path d=\"M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815\"></path></svg>","hunyuan":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Hunyuan</title><circle cx=\"12\" cy=\"12\" fill=\"#0055E9\" r=\"12\"></circle><path d=\"M12 0c.518 0 1.028.033 1.528.096A6.188 6.188 0 0112.12 12.28l-.12.001c-2.99 0-5.242 2.179-5.554 5.11-.223 2.086.353 4.412 2.242 6.146C3.672 22.1 0 17.479 0 12 0 5.373 5.373 0 12 0z\" fill=\"#A8DFF5\"></path><path d=\"M5.286 5a2.438 2.438 0 01.682 3.38c-3.962 5.966-3.215 10.743 2.648 15.136C3.636 22.056 0 17.452 0 12c0-1.787.39-3.482 1.09-5.006.253-.435.525-.872.817-1.311A2.438 2.438 0 015.286 5z\" fill=\"#0055E9\"></path><path d=\"M12.98.04c.272.021.543.053.81.093.583.106 1.117.254 1.538.44 6.638 2.927 8.07 10.052 1.748 15.642a4.125 4.125 0 01-5.822-.358c-1.51-1.706-1.3-4.184.357-5.822.858-.848 3.108-1.223 4.045-2.441 1.257-1.634 2.122-6.009-2.523-7.506L12.98.039z\" fill=\"#00BCFF\"></path><path d=\"M13.528.096A6.187 6.187 0 0112 12.281a5.75 5.75 0 00-1.71.255c.147-.905.595-1.784 1.321-2.501.858-.848 3.108-1.223 4.045-2.441 1.27-1.651 2.14-6.104-2.676-7.554.184.014.367.033.548.056z\" fill=\"#ECECEE\"></path></svg>","kimi":"<svg fill=\"currentColor\" fill-rule=\"evenodd\" height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Kimi</title><path d=\"M19.738 5.776c.163-.209.306-.4.457-.585.07-.087.064-.153-.004-.244-.655-.861-.717-1.817-.34-2.787.283-.73.909-1.072 1.674-1.145.477-.045.945.004 1.379.236.57.305.902.77 1.01 1.412.086.512.07 1.012-.075 1.508-.257.878-.888 1.333-1.753 1.448-.718.096-1.446.108-2.17.157-.056.004-.113 0-.178 0z\" fill=\"#027AFF\"></path><path d=\"M17.962 1.844h-4.326l-3.425 7.81H5.369V1.878H1.5V22h3.87v-8.477h6.824a3.025 3.025 0 002.743-1.75V22h3.87v-8.477a3.87 3.87 0 00-3.588-3.86v-.01h-2.125a3.94 3.94 0 002.323-2.12l2.545-5.689z\"></path></svg>","minimax":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Minimax</title><defs><linearGradient id=\"lobe-icons-minimax-fill\" x1=\"0%\" x2=\"100.182%\" y1=\"50.057%\" y2=\"50.057%\"><stop offset=\"0%\" stop-color=\"#E2167E\"></stop><stop offset=\"100%\" stop-color=\"#FE603C\"></stop></linearGradient></defs><path d=\"M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z\" fill=\"url(#lobe-icons-minimax-fill)\" fill-rule=\"nonzero\"></path></svg>","muse":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Meta</title><path d=\"M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z\" fill=\"url(#lobe-icons-meta-0-_R_0_)\"></path><path d=\"M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z\" fill=\"url(#lobe-icons-meta-1-_R_0_)\"></path><path d=\"M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z\" fill=\"url(#lobe-icons-meta-2-_R_0_)\"></path><path d=\"M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z\" fill=\"url(#lobe-icons-meta-3-_R_0_)\"></path><path d=\"M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z\" fill=\"url(#lobe-icons-meta-4-_R_0_)\"></path><path d=\"M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z\" fill=\"url(#lobe-icons-meta-5-_R_0_)\"></path><path d=\"M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z\" fill=\"#0082FB\"></path><path d=\"M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z\" fill=\"url(#lobe-icons-meta-6-_R_0_)\"></path><path d=\"M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z\" fill=\"#0082FB\"></path><path d=\"M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z\" fill=\"url(#lobe-icons-meta-7-_R_0_)\"></path><path d=\"M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z\" fill=\"url(#lobe-icons-meta-8-_R_0_)\"></path><path d=\"M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z\" fill=\"url(#lobe-icons-meta-9-_R_0_)\"></path><path d=\"M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z\" fill=\"url(#lobe-icons-meta-10-_R_0_)\"></path><path d=\"M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z\" fill=\"url(#lobe-icons-meta-11-_R_0_)\"></path><path d=\"M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z\" fill=\"url(#lobe-icons-meta-12-_R_0_)\"></path><defs><linearGradient id=\"lobe-icons-meta-0-_R_0_\" x1=\"75.897%\" x2=\"26.312%\" y1=\"89.199%\" y2=\"12.194%\"><stop offset=\".06%\" stop-color=\"#0867DF\"></stop><stop offset=\"45.39%\" stop-color=\"#0668E1\"></stop><stop offset=\"85.91%\" stop-color=\"#0064E0\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-1-_R_0_\" x1=\"21.67%\" x2=\"97.068%\" y1=\"75.874%\" y2=\"23.985%\"><stop offset=\"13.23%\" stop-color=\"#0064DF\"></stop><stop offset=\"99.88%\" stop-color=\"#0064E0\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-2-_R_0_\" x1=\"38.263%\" x2=\"60.895%\" y1=\"89.127%\" y2=\"16.131%\"><stop offset=\"1.47%\" stop-color=\"#0072EC\"></stop><stop offset=\"68.81%\" stop-color=\"#0064DF\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-3-_R_0_\" x1=\"47.032%\" x2=\"52.15%\" y1=\"90.19%\" y2=\"15.745%\"><stop offset=\"7.31%\" stop-color=\"#007CF6\"></stop><stop offset=\"99.43%\" stop-color=\"#0072EC\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-4-_R_0_\" x1=\"52.155%\" x2=\"47.591%\" y1=\"58.301%\" y2=\"37.004%\"><stop offset=\"7.31%\" stop-color=\"#007FF9\"></stop><stop offset=\"100%\" stop-color=\"#007CF6\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-5-_R_0_\" x1=\"37.689%\" x2=\"61.961%\" y1=\"12.502%\" y2=\"63.624%\"><stop offset=\"7.31%\" stop-color=\"#007FF9\"></stop><stop offset=\"100%\" stop-color=\"#0082FB\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-6-_R_0_\" x1=\"34.808%\" x2=\"62.313%\" y1=\"68.859%\" y2=\"23.174%\"><stop offset=\"27.99%\" stop-color=\"#007FF8\"></stop><stop offset=\"91.41%\" stop-color=\"#0082FB\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-7-_R_0_\" x1=\"43.762%\" x2=\"57.602%\" y1=\"6.235%\" y2=\"98.514%\"><stop offset=\"0%\" stop-color=\"#0082FB\"></stop><stop offset=\"99.95%\" stop-color=\"#0081FA\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-8-_R_0_\" x1=\"60.055%\" x2=\"39.88%\" y1=\"4.661%\" y2=\"69.077%\"><stop offset=\"6.19%\" stop-color=\"#0081FA\"></stop><stop offset=\"100%\" stop-color=\"#0080F9\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-9-_R_0_\" x1=\"30.282%\" x2=\"61.081%\" y1=\"59.32%\" y2=\"33.244%\"><stop offset=\"0%\" stop-color=\"#027AF3\"></stop><stop offset=\"100%\" stop-color=\"#0080F9\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-10-_R_0_\" x1=\"20.433%\" x2=\"82.112%\" y1=\"50.001%\" y2=\"50.001%\"><stop offset=\"0%\" stop-color=\"#0377EF\"></stop><stop offset=\"99.94%\" stop-color=\"#0279F1\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-11-_R_0_\" x1=\"40.303%\" x2=\"72.394%\" y1=\"35.298%\" y2=\"57.811%\"><stop offset=\".19%\" stop-color=\"#0471E9\"></stop><stop offset=\"100%\" stop-color=\"#0377EF\"></stop></linearGradient><linearGradient id=\"lobe-icons-meta-12-_R_0_\" x1=\"32.254%\" x2=\"68.003%\" y1=\"19.719%\" y2=\"84.908%\"><stop offset=\"27.65%\" stop-color=\"#0867DF\"></stop><stop offset=\"100%\" stop-color=\"#0471E9\"></stop></linearGradient></defs></svg>","openai":"<svg fill=\"currentColor\" fill-rule=\"evenodd\" height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>OpenAI</title><path d=\"M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z\"></path></svg>","qwen":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 24 24\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\"><title>Qwen</title><path d=\"M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z\" fill=\"url(#lobe-icons-qwen-fill)\" fill-rule=\"nonzero\"></path><defs><linearGradient id=\"lobe-icons-qwen-fill\" x1=\"0%\" x2=\"100%\" y1=\"0%\" y2=\"0%\"><stop offset=\"0%\" stop-color=\"#6336E7\" stop-opacity=\".84\"></stop><stop offset=\"100%\" stop-color=\"#6F69F7\" stop-opacity=\".84\"></stop></linearGradient></defs></svg>","mimo":"<svg role=\"img\" viewBox=\"0 0 24 24\" fill=\"#FF6900\" xmlns=\"http://www.w3.org/2000/svg\"><title>Xiaomi</title><path d=\"M12 0C8.016 0 4.756.255 2.493 2.516.23 4.776 0 8.033 0 12.012c0 3.98.23 7.235 2.494 9.497C4.757 23.77 8.017 24 12 24c3.983 0 7.243-.23 9.506-2.491C23.77 19.247 24 15.99 24 12.012c0-3.984-.233-7.243-2.502-9.504C19.234.252 15.978 0 12 0zM4.906 7.405h5.624c1.47 0 3.007.068 3.764.827.746.746.827 2.233.83 3.676v4.54a.15.15 0 0 1-.152.147h-1.947a.15.15 0 0 1-.152-.148V11.83c-.002-.806-.048-1.634-.464-2.051-.358-.36-1.026-.441-1.72-.458H7.158a.15.15 0 0 0-.151.147v6.98a.15.15 0 0 1-.152.148H4.906a.15.15 0 0 1-.15-.148V7.554a.15.15 0 0 1 .15-.149zm12.131 0h1.949a.15.15 0 0 1 .15.15v8.892a.15.15 0 0 1-.15.148h-1.949a.15.15 0 0 1-.151-.148V7.554a.15.15 0 0 1 .151-.149zM8.92 10.948h2.046c.083 0 .15.066.15.147v5.352a.15.15 0 0 1-.15.148H8.92a.15.15 0 0 1-.152-.148v-5.352a.15.15 0 0 1 .152-.147Z\" fill=\"#FF6900\"/></svg>","zhipu":"<svg height=\"1em\" style=\"flex:none;line-height:1\" viewBox=\"0 0 96 96\" width=\"1em\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"><title>Zhipu</title><image href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAOgSURBVHgB7Z3LcRpBEIYb2QcfCWGVARkIIhAZQAaQAUsE4AggAysDUAZkAI6Avfq0noaljGERjxn6MdNf1V/S6qLZ/ufRM10MDbhO06nr9ObUrp6bYFxi5bRx+nD6rH5/CAzyyGnrVJoe1swpgzvpgQU+pNZVTG9iBMDe4Fg1Agu+XBP6ghoZu3pwQgb7eUpD42MQrq+7TPJbZcAU9immQcMPpz9Oywb86/0GLYXT6wtYz+dit8FFA97B4OINDcjA4KKNa0AJBheFGcDMCxismAHMmAHMmAHMmAHMfAdPms3mTpwURbHTMZTt2mw24IPXyV6/3y+5abfbZ+1ar9clBbPZzPdkVLcBeZ6ftWk0GpUUoMlZlqVrAAbgtD0YECparZZv8EvVi3Cn0/nvGef8xWIBFIzHY1itVhAClSOgbuqZTCYlBXUjz0P6DHC9nK0d2+02xLyv14C6hQ+fqbKe4XAYMvi6DMCeX9f78O8UBEg5z+R9HM294XEpJ7j1ACj+Ny76vpuuOkqtokw5e73es95DXmBvFdW8P51On/kesoJ6qyh3u09+F1mBvUV49kNF4JRTvwGUKWfdZi95A+bzeUlB3WYveQMGg0FJQaBTzrgMwIDgMQAFT0w59RqgqMASnwHKCixxGaCtwBKVAe6MKbaUU5cBVCknwW5XnwGKCyz6DVBeYNFvgOYCi3oDIk85ZRsQSYFFrwGRFFh0GhBRgUWfAd1ut6RCyLwvx4AICyy6DIiwwKLHgEgLLDoMiLjAosOAiAss8g1IcLcrx4AECixyDUikwCLXgEQKLDINSKjAIs+AxAos8gxIrMAiywBLORkNSLTAIseARAssMgxIuMDCb0DiBZa75H1f0CkuIDCZTIACvK+h7mOjVB+drbun6BGCOspZYMHRQJXyIri5DBCzcMHnLLBQbvYOiDKAu8BCNfKOEWUAZ4GFauSdIsYAzt0u5cg7RYQB3AUW6nn/mBAGeF1Zxn1FGN6Ugmmvdh52j7PAgqOBmxAjwOu+IKre53Mx6zPu9wmJfX8AM3Z3NDNmADNmADNmADNmADNogP+BtvEwZgAvKzTgEwwufqMBSzC4+IU7YdzPr6ufBi2vhzXgJxjUzJ02hwfs/fg126WJRGuo+RbbvsCGxqoeXCAX1MhYlcMVcgGNTDb4B/qwn6e0vJh0bauY3kUG+5Va04tKDHwOX6T4DbhO5tR2eq9+b4FxiaLSEvYnDB9w5ajnLzy3z1aOtKIfAAAAAElFTkSuQmCC\" x=\"0\" y=\"0\" width=\"96\" height=\"96\" preserveAspectRatio=\"xMidYMid meet\"/></svg>","fallback":"<!-- @license lucide-static v1.30.0 - ISC -->\r\n<svg\r\n  class=\"lucide lucide-sparkles\"\r\n  xmlns=\"http://www.w3.org/2000/svg\"\r\n  width=\"24\"\r\n  height=\"24\"\r\n  viewBox=\"0 0 24 24\"\r\n  fill=\"none\"\r\n  stroke=\"currentColor\"\r\n  stroke-width=\"2\"\r\n  stroke-linecap=\"round\"\r\n  stroke-linejoin=\"round\"\r\n>\r\n  <path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" />\r\n  <path d=\"M20 2v4\" />\r\n  <path d=\"M22 4h-4\" />\r\n  <circle cx=\"4\" cy=\"20\" r=\"2\" />\r\n</svg>"};

// --- icon-registry.js ---
/**
 * 模型图标配置表（修改后在仓库根目录运行 `npm run sync` 并重启 Antigravity 即可生效）：
 *
 * 匹配优先级（从高到低）：
 * 1. DISABLED_MODEL_PATTERNS：命中则不显示任何图标（用于已废弃或不想展示图标的模型）
 * 2. MODEL_ICON_OVERRIDES：按具体模型名称 / ID / 别名优先覆盖指定图标
 * 3. PROVIDER_ICON_MAP：按后端返回的 provider 枚举兜底匹配品牌图标
 * 4. BRAND_ICON_RULES：按关键字兜底匹配整个模型系列
 * 5. 以上均未命中时，使用通用兜底图标 `fallback`（assets/ui/sparkles.svg）
 */

/**
 * 取消显示图标的模型清单（支持精确字符串或正则；命中后该行不渲染图标，也不回退为 sparkles）。
 * 示例：
 *   'Gemini 4 Argon',
 *   /^gpt-oss-120b$/i,
 */
const DISABLED_MODEL_PATTERNS = [];

/**
 * 具体模型精确/正则图标覆盖表：
 * - 适合给个别新模型、无品牌前缀的代号模型或单个模型单独指定图标；
 * - `icon` 对应 `assets/providers/<icon>.svg` 的文件名（其中 `xiaomimimo.svg` 的 key 为 `mimo`）。
 */
const MODEL_ICON_OVERRIDES = [
  // Antigravity Orchestrator 协调器模型（底层对应 gemini-pro-orchestrator / gemini-pro-coordinator）
  {
    match: /^(?:orchestrator|gemini-pro-(?:orchestrator|coordinator))$/i,
    icon: 'gemini',
  },
  {
    match: /\bgemini-pro-orchestrator-/i,
    icon: 'gemini',
  },
];

/**
 * 后端 provider 枚举到图标 key 的映射。
 */
const PROVIDER_ICON_MAP = [
  ['anthropic', 'anthropic'],
  ['google', 'gemini'],
  ['openai', 'openai'],
  ['deepseek', 'deepseek'],
  ['xai', 'grok'],
  ['glm', 'zhipu'],
  ['zhipu', 'zhipu'],
  ['kimi', 'kimi'],
];

/**
 * 品牌关键字兜底规则（按数组顺序从上到下匹配，越具体的规则建议放在越前面）。
 */
const BRAND_ICON_RULES = [
  { id: 'deepseek', test: (s) => s.includes('deepseek') },
  {
    id: 'anthropic',
    test: (s) =>
      /\b(?:claude|anthropic|sonnet|opus|haiku)\b/.test(s) ||
      s.includes('claude') ||
      s.includes('anthropic'),
  },
  {
    id: 'gemini',
    test: (s) => s.includes('gemini') || s.includes('gemma') || /\b(?:palm|bard)\b/.test(s),
  },
  {
    id: 'grok',
    test: (s) => s.includes('grok') || /(?:^|[^a-z0-9])xai(?:$|[^a-z0-9])/.test(s),
  },
  { id: 'mimo', test: (s) => s.includes('mimo') || s.includes('xiaomi') },
  { id: 'kimi', test: (s) => s.includes('kimi') || s.includes('moonshot') },
  { id: 'minimax', test: (s) => s.includes('minimax') },
  { id: 'qwen', test: (s) => s.includes('qwen') || s.includes('qwq') },
  {
    id: 'hunyuan',
    test: (s) =>
      s.includes('hunyuan') ||
      s.includes('tencent') ||
      /(?:^|[^a-z0-9])hy3(?:$|[^a-z0-9])/.test(s),
  },
  {
    id: 'muse',
    test: (s) => /\bmuse\b/.test(s) || s.includes('muse-spark') || s.includes('llama'),
  },
  {
    id: 'zhipu',
    test: (s) =>
      s.includes('zhipu') ||
      s.includes('chatglm') ||
      /(?:^|[^a-z0-9])glm(?:$|[^a-z0-9])/.test(s),
  },
  {
    id: 'openai',
    test: (s) =>
      s.includes('openai') ||
      s.includes('gpt') ||
      s.includes('codex') ||
      /(?:^|[^a-z0-9])o[134](?:$|[^a-z0-9])/.test(s),
  },
  // 放在其它显式品牌之后，避免外部模型恰好借用元素/媒体代号时误归为 Gemini
  {
    id: 'gemini',
    test: (s) =>
      /\b(?:lyria|imagen|veo)\b/.test(s) ||
      /(?:^|[^a-z0-9])(?:nano[\s_-]*banana|carbon|neon|hydrogen|argon)(?:$|[^a-z0-9])/.test(s),
  },
];

// --- model-core.js ---
/**
 * model-enhancer 纯函数核心模块：
 * 负责思考档位解析、品牌图标匹配与 SVG 实例 ID 去重，无 DOM / Node 依赖。
 */
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const EFFORT_LABELS = {
  'zh-CN': {
    low: '低',
    medium: '中',
    high: '高',
    xhigh: '超高',
    max: '极高',
  },
  en: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra',
    max: 'Max',
  },
};

const EFFORT_SUFFIX_RE = /^(.*?)\s*\((low|medium|high|xhigh|max)(?:\s+thinking)?\)\s*$/i;
function parseEffortLabel(label) {
  if (typeof label !== 'string') return null;
  const match = EFFORT_SUFFIX_RE.exec(label.trim());
  if (!match) return null;
  const base = match[1].trim();
  const effort = match[2].toLowerCase();
  if (!base) return null;
  return { base, effort };
}

function resolveGroupDisplayName(groupKey, byEffort, option, groupedModels) {
  const gm = groupedModels && typeof groupedModels === 'object' ? groupedModels[groupKey] : null;
  if (gm && typeof gm.displayName === 'string' && gm.displayName.trim()) {
    return gm.displayName.trim();
  }
  const parsed = parseEffortLabel(option?.label);
  if (parsed?.base) return parsed.base;
  if (byEffort instanceof Map) {
    for (const candidate of byEffort.values()) {
      const candidateBase = parseEffortLabel(candidate?.label)?.base;
      if (candidateBase) return candidateBase;
    }
  }
  return groupKey;
}
function resolveBaseAndEffort(option, effortIndex, groupedModels = null) {
  if (!option || option.isCustom) return null;
  const parsed = parseEffortLabel(option.label);

  if (effortIndex instanceof Map) {
    // Antigravity 新版 groupedModels 结构中 effortIndex 键名可能为 groupKey（如 gemini-4-neon）
    for (const [groupKey, byEffort] of effortIndex.entries()) {
      if (!(byEffort instanceof Map)) continue;
      for (const [effort, candidate] of byEffort.entries()) {
        if (
          candidate === option ||
          (candidate &&
            ((option.modelId && candidate.modelId === option.modelId) ||
              (candidate.label === option.label &&
                (candidate.value == null || option.value == null || candidate.value === option.value))))
        ) {
          return {
            base: resolveGroupDisplayName(groupKey, byEffort, option, groupedModels),
            groupKey,
            effort,
          };
        }
      }
    }
    if (parsed && effortIndex.has(parsed.base)) {
      return { base: parsed.base, groupKey: parsed.base, effort: parsed.effort };
    }
  }
  return parsed ? { base: parsed.base, groupKey: parsed.base, effort: parsed.effort } : null;
}

function findEffortGroupEntry(baseOrGroupKey, effortIndex, groupedModels = null) {
  if (!baseOrGroupKey || !(effortIndex instanceof Map)) return null;
  if (effortIndex.has(baseOrGroupKey)) {
    const direct = effortIndex.get(baseOrGroupKey);
    return direct instanceof Map ? direct : null;
  }
  if (groupedModels && typeof groupedModels === 'object') {
    for (const [groupKey, meta] of Object.entries(groupedModels)) {
      if (meta?.displayName === baseOrGroupKey && effortIndex.has(groupKey)) {
        const hit = effortIndex.get(groupKey);
        if (hit instanceof Map) return hit;
      }
    }
  }
  for (const byEffort of effortIndex.values()) {
    if (!(byEffort instanceof Map)) continue;
    for (const candidate of byEffort.values()) {
      if (parseEffortLabel(candidate?.label)?.base === baseOrGroupKey) {
        return byEffort;
      }
    }
  }
  return null;
}
function getAvailableEfforts(baseOrGroupKey, effortIndex, groupedModels = null) {
  const byEffort = findEffortGroupEntry(baseOrGroupKey, effortIndex, groupedModels);
  if (!byEffort || byEffort.size === 0) return [];

  const result = [];
  const seen = new Set();
  for (const effort of EFFORT_ORDER) {
    if (byEffort.has(effort)) {
      seen.add(effort);
      result.push({ effort, option: byEffort.get(effort) });
    }
  }
  for (const [effort, option] of byEffort.entries()) {
    if (!seen.has(effort)) {
      result.push({ effort, option });
    }
  }
  return result;
}
function getDefaultEffort(effortsList) {
  if (!Array.isArray(effortsList) || effortsList.length === 0) return null;
  const medium = effortsList.find((item) => item.effort === 'medium');
  return medium ? medium.effort : effortsList[0].effort;
}
function formatEffortLabel(effort, lang = 'en') {
  const key = String(effort || '').toLowerCase();
  const table = lang === 'zh-CN' ? EFFORT_LABELS['zh-CN'] : EFFORT_LABELS.en;
  return table[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');
}
function isOrchestratorModel(option) {
  const id = typeof option?.modelId === 'string' ? option.modelId.trim().toLowerCase() : '';
  return (
    id === 'gemini-pro-coordinator' ||
    id === 'gemini-pro-orchestrator' ||
    id.startsWith('gemini-pro-orchestrator-')
  );
}

function testSafeRegex(regex, text) {
  if (regex.global || regex.sticky) regex.lastIndex = 0;
  return regex.test(text);
}

function matchesRulePattern(pattern, fields, haystack) {
  if (!pattern) return false;
  if (pattern instanceof RegExp) {
    return fields.some((f) => testSafeRegex(pattern, f)) || (haystack ? testSafeRegex(pattern, haystack) : false);
  }
  if (typeof pattern === 'string') {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    if (fields.some((f) => f.toLowerCase() === p)) return true;
    return haystack.includes(p);
  }
  return false;
}
function resolveBrandId(meta = {}, registry = null) {
  const disabledPatterns = registry?.disabledPatterns ?? DISABLED_MODEL_PATTERNS;
  const overrides = registry?.overrides ?? MODEL_ICON_OVERRIDES;
  const providerMap = registry?.providerMap ?? PROVIDER_ICON_MAP;
  const brandRules = registry?.brandRules ?? BRAND_ICON_RULES;

  const parsedLabelBase = parseEffortLabel(meta.label)?.base || '';
  const fields = [
    meta.base,
    parsedLabelBase,
    meta.label,
    meta.displayName,
    meta.modelId,
    meta.modelAlias,
    meta.modelOrAlias?.model,
    meta.modelOrAlias?.alias,
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim());

  const haystack = fields.join(' ').toLowerCase();

  for (const pattern of disabledPatterns) {
    if (matchesRulePattern(pattern, fields, haystack)) {
      return null;
    }
  }

  for (const entry of overrides) {
    if (entry && entry.icon && matchesRulePattern(entry.match, fields, haystack)) {
      return entry.icon;
    }
  }

  const providerRaw = typeof meta.provider === 'string' ? meta.provider.toLowerCase() : '';
  if (providerRaw && !providerRaw.includes('unspecified') && !providerRaw.includes('antigravity')) {
    for (const [token, brandId] of providerMap) {
      if (providerRaw.includes(token)) return brandId;
    }
  }

  if (!haystack) return 'fallback';

  for (const rule of brandRules) {
    if (rule.test(haystack)) {
      return rule.id;
    }
  }
  return 'fallback';
}

let svgSeq = 0;
function prepareSvgMarkup(rawSvg, prefix = 'ag-me-svg') {
  if (typeof rawSvg !== 'string' || !rawSvg.trim()) return '';
  let markup = rawSvg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/gi, '').trim();
  const idMatches = [...markup.matchAll(/\bid="([^"]+)"/g)];
  if (idMatches.length > 0) {
    svgSeq += 1;
    const tag = `${prefix}-${svgSeq}`;
    for (const m of idMatches) {
      const oldId = m[1];
      const newId = `${tag}-${oldId}`;
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      markup = markup
        .replace(new RegExp(`id="${escaped}"`, 'g'), `id="${newId}"`)
        .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${newId})`)
        .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${newId}"`);
    }
  }
  return markup;
}
function createBrandSvgElement(doc, iconsMap, brandId) {
  if (!brandId) return null;
  const raw = (iconsMap && (iconsMap[brandId] || iconsMap.fallback)) || '';
  const markup = prepareSvgMarkup(raw);
  if (!markup || !doc?.createElement) return null;

  const tpl = doc.createElement('template');
  tpl.innerHTML = markup;
  const svg = tpl.content?.firstElementChild;
  if (!svg || String(svg.tagName).toLowerCase() !== 'svg') return null;

  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-ag-me-icon', brandId || 'fallback');
  svg.removeAttribute('style');
  return svg;
}

// --- slider-ui.js ---
/**
 * model-enhancer 前端 UI 控制器：
 * 1) 为模型选择列表中的每个模型项注入品牌 SVG 图标；
 * 2) 将模型选择器改造为 Codex 风格的二段式单面板（首屏思考深度拉条 <-> 带图标的模型列表）。
 */

const COPY = {
  'zh-CN': {
    modelTitle: '模型',
    bestOfNTitle: 'Best of N 模型',
    fixedDepth: '该模型为固定思考深度',
    resetAria: '恢复默认思考深度',
    switchModelAria: '切换模型',
    backAria: '返回思考深度调节',
    sliderAria: '思考深度',
  },
  en: {
    modelTitle: 'Model',
    bestOfNTitle: 'Best of N Models',
    fixedDepth: 'Fixed thinking depth',
    resetAria: 'Reset to default effort',
    switchModelAria: 'Switch model',
    backAria: 'Back to thinking slider',
    sliderAria: 'Thinking depth',
  },
};

const CHEVRON_RIGHT_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const CHEVRON_LEFT_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

const RESET_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';

function selectLocale(win, doc) {
  const htmlLang = String(doc?.documentElement?.lang || '').toLowerCase();
  if ((win && win.__myAntigravityZhCnInstalled) || htmlLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

function getReactFiber(el) {
  if (!el || typeof el !== 'object') return null;
  const keys = Object.keys(el);
  const fiberKey = keys.find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  );
  return fiberKey ? el[fiberKey] : null;
}

/**
 * 沿 React Fiber 树只读提取 ModelSelectorProvider 上下文与 XQc 非关闭式选中回调。
 */
function inspectModelSelectorPanel(panelEl) {
  let fiber = getReactFiber(panelEl);
  let ctx = null;
  let topmostXqcSetSelectedModel = null;
  let setIsOpen = null;

  for (let steps = 0; fiber && steps < 100; steps += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (!props || typeof props !== 'object') continue;

    const val = props.value;
    if (
      !ctx &&
      val &&
      typeof val === 'object' &&
      val.effortIndex instanceof Map &&
      Array.isArray(val.groups)
    ) {
      ctx = val;
    }

    if (
      typeof props.setSelectedModel === 'function' &&
      typeof props.setIsOpen === 'function' &&
      Array.isArray(props.modelSorts)
    ) {
      // LQc 在内层、XQc 在外层；持续向上覆盖可拿到外层 XQc 不关弹窗的 setSelectedModel
      topmostXqcSetSelectedModel = props.setSelectedModel;
      setIsOpen = props.setIsOpen;
    }
  }

  const rawSetSelectedModel =
    (typeof ctx?.contextWindow?.select === 'function' ? ctx.contextWindow.select : null) ||
    (topmostXqcSetSelectedModel && topmostXqcSetSelectedModel !== ctx?.setSelectedModel
      ? topmostXqcSetSelectedModel
      : null);

  return {
    ctx,
    rawSetSelectedModel,
    canStayOpen: Boolean(rawSetSelectedModel),
    setIsOpen,
  };
}

/**
 * 从模型行 DOM 只读提取其对应的 ClientModelConfig 选项对象。
 */
function inspectModelItemFiber(itemEl) {
  let fiber = getReactFiber(itemEl);
  for (let steps = 0; fiber && steps < 18; steps += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props && typeof props === 'object' && props.model && typeof props.model.label === 'string') {
      return props.model;
    }
  }
  return null;
}

/**
 * 从 Orchestrator 子菜单项沿 React Fiber 向上查找所属规划器分组（key / title）。
 * 注意：子菜单经过多层 MenuPopup / Positioner / Context Provider，需遍历足够深的 Fiber 层级，
 * 并在未命中时回退读取 DOM 中当前展开的 [data-testid="orchestrator-picker-row"]。
 */
function inspectOrchestratorSubmenuFiber(el, doc) {
  let fiber = getReactFiber(el);
  let groupKey = '';
  let baseName = '';
  for (let steps = 0; fiber && steps < 120; steps += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (!props || typeof props !== 'object') continue;
    // RVb 中每组使用 <SubmenuRoot key={groupKey} title={group.base}>，内部通过 gW.Provider 传递 { title }
    const title =
      typeof props.title === 'string' && props.title
        ? props.title
        : typeof props.value?.title === 'string' && props.value.title
          ? props.value.title
          : '';
    if (title) {
      baseName = title;
      if (typeof fiber.key === 'string' && fiber.key) {
        groupKey = fiber.key;
      }
      break;
    }
  }
  if (!baseName && doc?.querySelector) {
    const openTrigger = doc.querySelector(
      '[data-testid="orchestrator-picker-row"][data-popup-open][data-model-base], [data-testid="orchestrator-picker-row"][aria-expanded="true"][data-model-base]',
    );
    baseName = openTrigger?.getAttribute?.('data-model-base') || '';
  }
  return { groupKey, baseName };
}

function findOrchestratorModelOption(ctx) {
  if (!ctx) return null;
  if (isOrchestratorModel(ctx.selectedModel)) return ctx.selectedModel;
  if (Array.isArray(ctx.modelOptions)) {
    const hit = ctx.modelOptions.find((opt) => isOrchestratorModel(opt) && !opt.disabled);
    if (hit) return hit;
  }
  if (Array.isArray(ctx.groups)) {
    for (const group of ctx.groups) {
      if (!Array.isArray(group?.options)) continue;
      const hit = group.options.find((opt) => isOrchestratorModel(opt) && !opt.disabled);
      if (hit) return hit;
    }
  }
  return null;
}

function isOwnUiNode(node) {
  if (!node || node.nodeType !== 1) return false;
  return Boolean(
    node.closest?.('[data-ag-me-slider-view], [data-ag-me-list-header], [data-ag-me-icon]'),
  );
}
function createModelEnhancerController(win, doc, iconsMap = {}) {
  const panels = new Map();
  let suppressOutsideClick = false;
  let suppressOutsideTimer = null;
  let lastOrchPick = { value: undefined, time: 0 };

  function suppressOutsideClickOnce() {
    suppressOutsideClick = true;
    if (suppressOutsideTimer != null && typeof win.clearTimeout === 'function') {
      win.clearTimeout(suppressOutsideTimer);
    }
    if (typeof win.setTimeout === 'function') {
      suppressOutsideTimer = win.setTimeout(() => {
        suppressOutsideClick = false;
        suppressOutsideTimer = null;
      }, 80);
    }
  }

  function handleOrchestratorPickerClick(event) {
    if (panels.size === 0) return false;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return false;

    const effortSpan =
      target.closest('[data-testid="orchestrator-picker-effort"]') ||
      target.closest('[role="menuitemradio"]')?.querySelector?.('[data-testid="orchestrator-picker-effort"]');
    const pickerRow = !effortSpan ? target.closest('[data-testid="orchestrator-picker-row"]') : null;
    if (!effortSpan && !pickerRow) return false;

    let activePanel = null;
    for (const panelEl of panels.keys()) {
      if (panelEl.isConnected) {
        activePanel = panelEl;
        break;
      }
    }
    if (!activePanel) return false;

    const fiberInfo = inspectModelSelectorPanel(activePanel);
    const ctx = fiberInfo.ctx;
    const selectOverride = ctx?.orchestratorPick?.select;
    if (typeof selectOverride !== 'function') return false;

    const groupedModels = ctx.userStatus?.cascadeModelConfigData?.groupedModels;
    const plannerIndex = ctx.orchestratorPlannerIndex;
    const planners = Array.isArray(ctx.orchestratorPlanners) ? ctx.orchestratorPlanners : [];

    let chosenOption = null;
    if (effortSpan) {
      const effortKey = String(effortSpan.getAttribute('data-effort') || '').toLowerCase();
      if (!effortKey) return false;
      const { groupKey, baseName } = inspectOrchestratorSubmenuFiber(effortSpan, doc);
      const efforts = getAvailableEfforts(groupKey || baseName, plannerIndex, groupedModels);
      chosenOption = efforts.find((entry) => entry.effort === effortKey)?.option || null;
    } else if (pickerRow) {
      const base = pickerRow.getAttribute('data-model-base') || '';
      const label = pickerRow.getAttribute('data-model-label') || '';
      if (base) {
        const { groupKey } = inspectOrchestratorSubmenuFiber(pickerRow, doc);
        const efforts = getAvailableEfforts(groupKey || base, plannerIndex, groupedModels);
        const defaultEffort = getDefaultEffort(efforts);
        chosenOption =
          efforts.find((entry) => entry.effort === defaultEffort)?.option || efforts[0]?.option || null;
      } else if (label) {
        chosenOption = planners.find((opt) => opt?.label === label) || null;
      }
    }

    if (!chosenOption || chosenOption.value == null) return false;

    // 阻止 Base UI 菜单项（含 onMouseUp 触发的 el.click() 与原生 click）默认关闭弹窗
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const now = Date.now();
    if (lastOrchPick.value !== chosenOption.value || now - lastOrchPick.time > 60) {
      lastOrchPick = { value: chosenOption.value, time: now };
      selectOverride(chosenOption.value);
      if (!isOrchestratorModel(ctx.selectedModel) && typeof fiberInfo.rawSetSelectedModel === 'function') {
        const orchOpt = findOrchestratorModelOption(ctx);
        if (orchOpt) {
          fiberInfo.rawSetSelectedModel(orchOpt);
        }
      }
    }
    return true;
  }

  function handleDocClickCapture(event) {
    if (suppressOutsideClick) {
      suppressOutsideClick = false;
      if (suppressOutsideTimer != null && typeof win.clearTimeout === 'function') {
        win.clearTimeout(suppressOutsideTimer);
        suppressOutsideTimer = null;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    handleOrchestratorPickerClick(event);
  }

  // 在 window 捕获阶段监听，确保早于页面上任意 document / #root 级捕获监听
  win.addEventListener?.('click', handleDocClickCapture, true);

  function syncActiveAttribute() {
    if (!doc?.documentElement) return;
    if (panels.size > 0) {
      doc.documentElement.setAttribute('data-ag-me-active', 'true');
    } else {
      doc.documentElement.removeAttribute('data-ag-me-active');
    }
  }

  function createPanelInstance(panelEl) {
    let stage = 'slider';
    let userChoseList = false;
    let canReturnToSlider = false;
    let dragging = false;
    let isActiveDrag = false;
    let dragStartX = 0;
    let dragRect = null;
    let previewIndexValue = 0;
    let currentEfforts = [];
    let currentBaseName = '';
    let currentOption = null;
    let currentActiveIndex = 0;
    let currentDefaultEffort = null;
    let currentCwSelected = undefined;
    let transitionEpoch = 0;
    let activeAnimations = [];

    function cancelTransitionAnimations() {
      for (const anim of activeAnimations) {
        try {
          anim.cancel();
        } catch {
          // ignore
        }
      }
      activeAnimations = [];
      panelEl.removeAttribute('data-ag-me-animating');
    }

    function prefersReducedMotion() {
      try {
        return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      } catch {
        return false;
      }
    }

    function switchStageAnimated(nextStage, { beforeUpdate, afterSwitch } = {}) {
      const canAnimate =
        !prefersReducedMotion() &&
        typeof panelEl.animate === 'function' &&
        typeof panelEl.getBoundingClientRect === 'function';

      if (!canAnimate) {
        cancelTransitionAnimations();
        stage = nextStage;
        beforeUpdate?.();
        update();
        afterSwitch?.();
        return;
      }

      const fromRect = panelEl.getBoundingClientRect();
      cancelTransitionAnimations();

      stage = nextStage;
      beforeUpdate?.();
      update();

      const toRect = panelEl.getBoundingClientRect();
      const fromW = Math.round(fromRect?.width || 0);
      const fromH = Math.round(fromRect?.height || 0);
      const toW = Math.round(toRect?.width || 0);
      const toH = Math.round(toRect?.height || 0);

      if (fromW > 0 && fromH > 0 && toW > 0 && toH > 0 && (fromW !== toW || fromH !== toH)) {
        transitionEpoch += 1;
        const myEpoch = transitionEpoch;
        panelEl.setAttribute('data-ag-me-animating', 'true');

        const sizeAnim = panelEl.animate(
          [
            { width: `${fromW}px`, height: `${fromH}px` },
            { width: `${toW}px`, height: `${toH}px` },
          ],
          {
            duration: 240,
            easing: 'cubic-bezier(0.19, 1, 0.22, 1)',
          },
        );
        if (sizeAnim) {
          activeAnimations.push(sizeAnim);
          const cleanup = () => {
            if (transitionEpoch === myEpoch) {
              panelEl.removeAttribute('data-ag-me-animating');
            }
          };
          sizeAnim.onfinish = cleanup;
          sizeAnim.oncancel = cleanup;
        } else {
          panelEl.removeAttribute('data-ag-me-animating');
        }
      }

      const contentTargets =
        nextStage === 'slider'
          ? [sliderView]
          : Array.from(panelEl.children || []).filter(
              (el) => el !== sliderView && typeof el.animate === 'function' && !el.hidden,
            );
      const yOffset = nextStage === 'slider' ? -4 : 6;

      for (const el of contentTargets) {
        if (typeof el.animate !== 'function') continue;
        const contentAnim = el.animate(
          [
            { opacity: 0, transform: `translateY(${yOffset}px)` },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 190,
            delay: nextStage === 'list' ? 25 : 0,
            easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
            fill: 'backwards',
          },
        );
        if (contentAnim) {
          activeAnimations.push(contentAnim);
        }
      }

      afterSwitch?.();
    }

    // --- Stage 1: Codex 风格思考深度拉条视图 ---
    const sliderView = doc.createElement('div');
    sliderView.setAttribute('data-ag-me-slider-view', 'true');
    sliderView.setAttribute('data-my-antigravity-no-i18n', 'true');

    const sliderHeader = doc.createElement('div');
    sliderHeader.setAttribute('data-ag-me-slider-header', 'true');

    const headerSpacer = doc.createElement('div');
    headerSpacer.setAttribute('aria-hidden', 'true');

    const headerCenter = doc.createElement('div');
    headerCenter.setAttribute('data-ag-me-header-center', 'true');

    const effortTitle = doc.createElement('div');
    effortTitle.setAttribute('data-ag-me-effort-title', 'true');

    const modelSwitchBtn = doc.createElement('button');
    modelSwitchBtn.type = 'button';
    modelSwitchBtn.setAttribute('data-ag-me-model-switch', 'true');
    const modelSwitchName = doc.createElement('span');
    modelSwitchName.setAttribute('data-ag-me-model-switch-name', 'true');
    modelSwitchBtn.append(modelSwitchName);
    modelSwitchBtn.insertAdjacentHTML('beforeend', CHEVRON_RIGHT_SVG);

    headerCenter.append(effortTitle, modelSwitchBtn);

    const resetBtn = doc.createElement('button');
    resetBtn.type = 'button';
    resetBtn.setAttribute('data-ag-me-reset', 'true');
    resetBtn.innerHTML = RESET_SVG;

    sliderHeader.append(headerSpacer, headerCenter, resetBtn);

    const rail = doc.createElement('div');
    rail.setAttribute('data-ag-me-rail', 'true');
    rail.setAttribute('role', 'slider');
    rail.setAttribute('tabindex', '0');

    const rangeEl = doc.createElement('div');
    rangeEl.setAttribute('data-ag-me-range', 'true');

    const ticksEl = doc.createElement('div');
    ticksEl.setAttribute('data-ag-me-ticks', 'true');

    const thumbEl = doc.createElement('div');
    thumbEl.setAttribute('data-ag-me-thumb', 'true');

    rail.append(rangeEl, ticksEl, thumbEl);

    const fixedNote = doc.createElement('div');
    fixedNote.setAttribute('data-ag-me-fixed-note', 'true');
    fixedNote.hidden = true;

    const cwRow = doc.createElement('div');
    cwRow.setAttribute('data-ag-me-cw-row', 'true');
    cwRow.hidden = true;

    sliderView.append(sliderHeader, rail, fixedNote, cwRow);

    // --- Stage 2: 带返回入口的模型列表顶部头 ---
    const listHeader = doc.createElement('div');
    listHeader.setAttribute('data-ag-me-list-header', 'true');
    listHeader.setAttribute('data-my-antigravity-no-i18n', 'true');

    const backBtn = doc.createElement('button');
    backBtn.type = 'button';
    backBtn.setAttribute('data-ag-me-back-btn', 'true');
    backBtn.insertAdjacentHTML('beforeend', CHEVRON_LEFT_SVG);
    const backBtnLabel = doc.createElement('span');
    backBtn.append(backBtnLabel);

    const listTitle = doc.createElement('div');
    listTitle.setAttribute('data-ag-me-list-title', 'true');

    listHeader.append(backBtn, listTitle);

    function getLocaleAndCopy() {
      const locale = selectLocale(win, doc);
      return { locale, copy: COPY[locale] || COPY.en };
    }

    function applySliderVisual(index, totalCount, effortKey, locale, overrideRatio = null) {
      const count = Math.max(1, totalCount);
      const safeIndex = Math.max(0, Math.min(count - 1, index));
      const snappedRatio = count <= 1 ? 0 : safeIndex / (count - 1);
      const ratio =
        typeof overrideRatio === 'number'
          ? Math.min(1, Math.max(0, overrideRatio))
          : snappedRatio;

      sliderView.style.setProperty('--ag-me-p', String(ratio));
      rail.setAttribute('aria-valuemin', '0');
      rail.setAttribute('aria-valuemax', String(count - 1));
      rail.setAttribute('aria-valuenow', String(safeIndex));
      rail.setAttribute('aria-valuetext', formatEffortLabel(effortKey, locale));

      effortTitle.textContent = formatEffortLabel(effortKey, locale);

      const tickEls = ticksEl.children;
      for (let i = 0; i < tickEls.length; i += 1) {
        const tickRatio = count <= 1 ? 0 : i / (count - 1);
        tickEls[i].setAttribute('data-passed', String(tickRatio <= ratio + 0.015));
      }
    }

    function ensureTicks(count) {
      if (ticksEl.children.length === count) return;
      ticksEl.replaceChildren();
      for (let i = 0; i < count; i += 1) {
        const tick = doc.createElement('span');
        tick.setAttribute('data-ag-me-tick', 'true');
        const p = count <= 1 ? 0 : i / (count - 1);
        tick.style.left = `calc(var(--ag-me-thumb-r) + (100% - 2 * var(--ag-me-thumb-r)) * ${p})`;
        ticksEl.append(tick);
      }
    }

    function commitModelSelection(option, cwName) {
      if (!option) return;
      const fiberInfo = inspectModelSelectorPanel(panelEl);
      const setter = fiberInfo.rawSetSelectedModel || fiberInfo.ctx?.setSelectedModel;
      if (typeof setter !== 'function') return;

      setter(option, cwName);
      // XQc 内部可能把焦点拉回编辑器；若仍停留在拉条视图且菜单未关，立刻恢复焦点到滑轨
      if (fiberInfo.canStayOpen && stage === 'slider' && panelEl.isConnected && !rail.hidden) {
        try {
          rail.focus({ preventScroll: true });
        } catch {
          // 忽略测试环境无 focus 选项的情况
        }
      }
    }

    function ratioFromClientX(clientX) {
      const rect = dragRect || rail.getBoundingClientRect();
      const width = Math.max(1, rect.width || 1);
      const halfTrack = rect.height ? rect.height / 2 : 11;
      const inset = Math.min(Math.max(8, halfTrack), width / 4);
      const usable = Math.max(1, width - inset * 2);
      return Math.min(1, Math.max(0, (clientX - rect.left - inset) / usable));
    }

    function indexFromClientX(clientX) {
      const count = currentEfforts.length;
      if (count <= 1) return 0;
      return Math.round(ratioFromClientX(clientX) * (count - 1));
    }

    function previewAtIndex(idx, overrideRatio = null) {
      if (!currentEfforts.length) return;
      const safe = Math.max(0, Math.min(currentEfforts.length - 1, idx));
      previewIndexValue = safe;
      const entry = currentEfforts[safe];
      const { locale } = getLocaleAndCopy();
      applySliderVisual(safe, currentEfforts.length, entry.effort, locale, overrideRatio);
      resetBtn.disabled = !currentDefaultEffort || entry.effort === currentDefaultEffort;
    }

    rail.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || currentEfforts.length < 2) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      isActiveDrag = false;
      dragStartX = event.clientX;
      dragRect = rail.getBoundingClientRect();
      // 点击时不立即关闭 CSS transition，等产生明显位移后再进入无延迟跟手拖拽
      try {
        rail.setPointerCapture?.(event.pointerId);
      } catch {
        // 忽略不支持 pointerCapture 的环境
      }
      try {
        rail.focus({ preventScroll: true });
      } catch {
        // ignore
      }
      previewAtIndex(indexFromClientX(event.clientX));
    });

    rail.addEventListener('pointermove', (event) => {
      if (!dragging || currentEfforts.length < 2) return;
      if (!isActiveDrag && Math.abs(event.clientX - dragStartX) > 3) {
        isActiveDrag = true;
        rail.setAttribute('data-dragging', 'true');
      }
      if (isActiveDrag) {
        const rawRatio = ratioFromClientX(event.clientX);
        const snappedIdx = Math.round(rawRatio * (currentEfforts.length - 1));
        previewAtIndex(snappedIdx, rawRatio);
      }
    });

    function finishDrag(clientX, commit, target) {
      if (!dragging) return;
      const wasActiveDrag = isActiveDrag;
      dragging = false;
      isActiveDrag = false;
      if (wasActiveDrag || rail.hasAttribute('data-dragging')) {
        rail.removeAttribute('data-dragging');
        // 强制刷新一次样式计算，确保松手回弹刻度时 CSS 过渡稳定生效
        void rail.offsetWidth;
      }
      if (commit && clientX != null) {
        previewAtIndex(indexFromClientX(clientX));
      }
      dragRect = null;
      if (target && !panelEl.contains(target)) {
        suppressOutsideClickOnce();
      }
      if (commit && currentEfforts[previewIndexValue]) {
        const chosen = currentEfforts[previewIndexValue];
        if (previewIndexValue !== currentActiveIndex) {
          currentActiveIndex = previewIndexValue;
          commitModelSelection(chosen.option, currentCwSelected);
        }
      } else {
        previewAtIndex(currentActiveIndex);
      }
    }

    rail.addEventListener('pointerup', (event) => {
      finishDrag(event.clientX, true, event.target);
    });

    rail.addEventListener('pointercancel', (event) => {
      finishDrag(null, false, event.target);
    });

    rail.addEventListener('keydown', (event) => {
      if (currentEfforts.length < 2) return;
      let nextIdx = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        nextIdx = Math.max(0, currentActiveIndex - 1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        nextIdx = Math.min(currentEfforts.length - 1, currentActiveIndex + 1);
      } else if (event.key === 'Home') {
        nextIdx = 0;
      } else if (event.key === 'End') {
        nextIdx = currentEfforts.length - 1;
      }
      if (nextIdx === null) return;
      event.preventDefault();
      event.stopPropagation();
      previewAtIndex(nextIdx);
      if (nextIdx !== currentActiveIndex && currentEfforts[nextIdx]) {
        currentActiveIndex = nextIdx;
        commitModelSelection(currentEfforts[nextIdx].option, currentCwSelected);
      }
    });

    modelSwitchBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      userChoseList = true;
      switchStageAnimated('list');
    });

    resetBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!currentDefaultEffort) return;
      const targetIdx = currentEfforts.findIndex((item) => item.effort === currentDefaultEffort);
      if (targetIdx < 0 || targetIdx === currentActiveIndex) return;
      currentActiveIndex = targetIdx;
      previewAtIndex(targetIdx);
      commitModelSelection(currentEfforts[targetIdx].option, currentCwSelected);
    });

    backBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canReturnToSlider) return;
      userChoseList = false;
      switchStageAnimated('slider', {
        afterSwitch() {
          try {
            rail.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        },
      });
    });

    // Stage 2：点击多思考档位模型行时切换模型并切回 Stage 1（拉条面板）
    function handlePanelClickCapture(event) {
      if (stage !== 'list') return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (
        target.closest(
          '[data-ag-me-slider-view], [data-ag-me-list-header], [data-testid="model-selector-refresh"], [role="menuitemcheckbox"]',
        )
      ) {
        return;
      }
      const item = target.closest('[role="menuitem"]');
      if (!item || !panelEl.contains(item)) return;
      if (item.getAttribute('aria-disabled') === 'true' || item.hasAttribute('disabled')) {
        return;
      }

      const effortGroupEl = item.querySelector('[data-testid="model-selector-effort-group"]');
      if (!effortGroupEl) {
        // 单变体模型或 View Usage 等其他菜单项：保留原生点击行为
        return;
      }

      const fiberInfo = inspectModelSelectorPanel(panelEl);
      if (!fiberInfo.canStayOpen || !fiberInfo.ctx) return;

      const baseName =
        effortGroupEl.getAttribute('data-model-base') || effortGroupEl.textContent?.trim() || '';
      const groupedModels = fiberInfo.ctx.userStatus?.cascadeModelConfigData?.groupedModels;
      const efforts = getAvailableEfforts(baseName, fiberInfo.ctx.effortIndex, groupedModels);
      if (efforts.length < 2) return;

      const currentParsed = resolveBaseAndEffort(
        fiberInfo.ctx.selectedModel,
        fiberInfo.ctx.effortIndex,
        groupedModels,
      );
      const preferredEffort =
        currentParsed?.base === baseName ? currentParsed.effort : getDefaultEffort(efforts);
      const targetEntry =
        efforts.find((entry) => entry.effort === preferredEffort) || efforts[0];
      if (!targetEntry?.option) return;

      event.preventDefault();
      event.stopPropagation();
      userChoseList = false;
      switchStageAnimated('slider', {
        beforeUpdate() {
          commitModelSelection(targetEntry.option);
        },
        afterSwitch() {
          try {
            rail.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        },
      });
    }

    panelEl.addEventListener('click', handlePanelClickCapture, true);

    // Stage 2：拦截多档位模型行的悬停事件，阻止 Base UI SubmenuTrigger 打开隐藏子菜单
    // （避免 safePolygon / blockPointerEvents 抢占指针导致悬停闪烁或关闭）
    function handlePanelHoverCapture(event) {
      if (stage !== 'list') return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const item = target.closest('[role="menuitem"]');
      if (!item || !panelEl.contains(item)) return;
      if (!item.querySelector('[data-testid="model-selector-effort-group"]')) {
        return;
      }
      event.stopPropagation();
      if (event.type === 'mousemove' && doc.activeElement !== item) {
        if (
          item.getAttribute('aria-disabled') !== 'true' &&
          !item.hasAttribute('disabled') &&
          doc.hasFocus?.() !== false
        ) {
          try {
            item.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        }
      }
    }

    for (const hoverType of ['mouseenter', 'mouseover', 'mousemove', 'pointerenter', 'pointerover']) {
      panelEl.addEventListener(hoverType, handlePanelHoverCapture, true);
    }

    function buildRowMeta(modelObj, fallback = {}) {
      return {
        base: fallback.base,
        label: modelObj?.label || fallback.label || '',
        displayName: modelObj?.displayName,
        modelId: modelObj?.modelId,
        modelAlias: modelObj?.modelAlias,
        modelOrAlias: modelObj?.modelOrAlias,
        provider: modelObj?.provider,
      };
    }

    function injectRowIcon(container, meta) {
      if (!container) return;
      const brandId = resolveBrandId(meta);
      const existing = container.querySelector(':scope > [data-ag-me-icon]');
      if (!brandId) {
        if (existing) existing.remove();
        return;
      }
      if (existing) {
        if (existing.getAttribute('data-ag-me-icon') === brandId) {
          return;
        }
        existing.remove();
      }
      const svg = createBrandSvgElement(doc, iconsMap, brandId);
      if (svg) {
        container.prepend(svg);
      }
    }

    function enhanceModelRows() {
      // 1. 多档位模型组（位于 HW 的内部 flex span 中）
      for (const groupEl of panelEl.querySelectorAll('[data-testid="model-selector-effort-group"]')) {
        const container = groupEl.parentElement;
        const item = groupEl.closest('[role="menuitem"]');
        const modelObj = inspectModelItemFiber(item || groupEl);
        const base = groupEl.getAttribute('data-model-base') || groupEl.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { base, label: base }));
      }

      // 2. 单变体模型、自定义模型与新版 Orchestrator 协调器行
      for (const itemEl of panelEl.querySelectorAll(
        '[data-testid="model-selector-item"], [data-testid="model-selector-custom-item"], [data-testid="model-selector-orchestrator"]',
      )) {
        const container = itemEl.querySelector(':scope > span') || itemEl;
        const modelObj = inspectModelItemFiber(itemEl);
        const label = itemEl.getAttribute('data-model-label') || itemEl.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { label }));
      }

      // 3. Best of N 模式下的复选模型行
      for (const checkItem of panelEl.querySelectorAll('[role="menuitemcheckbox"]')) {
        const container = checkItem.querySelector(':scope > span') || checkItem;
        const modelObj = inspectModelItemFiber(checkItem);
        const label = checkItem.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { label }));
      }

      // 4. Orchestrator 右侧规划器子菜单行（Portal 挂载于 document 内）
      for (const pickerRow of doc.querySelectorAll('[data-testid="orchestrator-picker-row"]')) {
        const container = pickerRow.querySelector(':scope > span') || pickerRow;
        const modelObj = inspectModelItemFiber(pickerRow);
        const base = pickerRow.getAttribute('data-model-base') || '';
        const label =
          pickerRow.getAttribute('data-model-label') || base || pickerRow.textContent?.trim() || '';
        injectRowIcon(container, buildRowMeta(modelObj, { base, label }));
      }
    }

    function renderContextWindowRow(option, ctx) {
      const cwList = option?.contextWindowOptions;
      if (!Array.isArray(cwList) || cwList.length === 0 || !ctx?.contextWindow) {
        cwRow.hidden = true;
        cwRow.replaceChildren();
        currentCwSelected = undefined;
        return;
      }
      currentCwSelected = ctx.contextWindow.selected;
      cwRow.hidden = false;
      cwRow.replaceChildren();
      for (const cw of cwList) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-ag-me-cw-btn', 'true');
        const active = currentCwSelected === cw.name;
        btn.setAttribute('data-selected', String(active));
        btn.textContent = cw.name;
        if (cw.description) btn.title = cw.description;
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          currentCwSelected = cw.name;
          commitModelSelection(option, cw.name);
          update();
        });
        cwRow.append(btn);
      }
    }

    function mountAnchors() {
      if (!listHeader.isConnected || listHeader.parentElement !== panelEl) {
        panelEl.append(listHeader);
      }
      if (!sliderView.isConnected || sliderView.parentElement !== panelEl) {
        panelEl.append(sliderView);
      }
    }

    function update() {
      if (!panelEl.isConnected) return;
      mountAnchors();

      const { locale, copy } = getLocaleAndCopy();
      const fiberInfo = inspectModelSelectorPanel(panelEl);
      const ctx = fiberInfo.ctx;

      const isBestOfN = Boolean(ctx?.bestOfNConfig?.isBestOfNEnabled);
      const isLoading = Boolean(ctx?.isModelListLoading);
      const selectedModel = ctx?.selectedModel || null;
      const isOrchestratorSelected = isOrchestratorModel(selectedModel);

      // Orchestrator 保留原版列表与多级子菜单交互，不切入 Stage 1 滑条卡片
      canReturnToSlider = Boolean(
        ctx && !isBestOfN && !isLoading && selectedModel && !isOrchestratorSelected,
      );

      if (!canReturnToSlider) {
        stage = 'list';
      } else if (!userChoseList) {
        stage = 'slider';
      }

      panelEl.setAttribute('data-ag-me-stage', stage);
      panelEl.setAttribute('data-ag-me-has-list-header', 'true');

      if (stage === 'slider' && selectedModel) {
        sliderView.hidden = false;
        listHeader.hidden = true;

        const groupedModels = ctx.userStatus?.cascadeModelConfigData?.groupedModels;
        const parsed = resolveBaseAndEffort(selectedModel, ctx.effortIndex, groupedModels);
        currentBaseName = parsed?.base || selectedModel.label || '';
        currentEfforts = parsed
          ? getAvailableEfforts(parsed.groupKey || parsed.base, ctx.effortIndex, groupedModels)
          : [];

        modelSwitchName.textContent = currentBaseName;
        modelSwitchBtn.setAttribute('aria-label', copy.switchModelAria);
        resetBtn.setAttribute('aria-label', copy.resetAria);
        resetBtn.title = copy.resetAria;
        rail.setAttribute('aria-label', copy.sliderAria);

        if (currentEfforts.length >= 2) {
          rail.hidden = false;
          fixedNote.hidden = true;
          resetBtn.hidden = false;

          const activeIdx = Math.max(
            0,
            currentEfforts.findIndex((item) => item.effort === parsed?.effort),
          );
          currentActiveIndex = activeIdx;
          currentOption = currentEfforts[activeIdx]?.option || selectedModel;
          currentDefaultEffort = getDefaultEffort(currentEfforts);

          ensureTicks(currentEfforts.length);
          if (!dragging) {
            previewIndexValue = activeIdx;
            const effortKey = currentEfforts[activeIdx]?.effort || parsed?.effort || 'medium';
            applySliderVisual(activeIdx, currentEfforts.length, effortKey, locale);
            resetBtn.disabled = !currentDefaultEffort || effortKey === currentDefaultEffort;
          }
          renderContextWindowRow(currentOption, ctx);
        } else {
          // 固定思考深度模型：保留切换模型入口并显示清晰提示
          rail.hidden = true;
          resetBtn.hidden = true;
          fixedNote.hidden = false;
          fixedNote.textContent = copy.fixedDepth;
          effortTitle.textContent = currentBaseName;
          modelSwitchName.textContent = copy.switchModelAria;
          currentOption = selectedModel;
          currentDefaultEffort = null;
          renderContextWindowRow(selectedModel, ctx);
        }
      } else {
        sliderView.hidden = true;
        listHeader.hidden = false;

        backBtn.hidden = !canReturnToSlider;
        backBtn.setAttribute('aria-label', copy.backAria);
        backBtnLabel.textContent = copy.modelTitle;

        listTitle.hidden = canReturnToSlider;
        listTitle.textContent = isBestOfN ? copy.bestOfNTitle : copy.modelTitle;

        enhanceModelRows();
      }
    }

    function returnFromListToSlider() {
      if (stage !== 'list' || !canReturnToSlider) return false;
      userChoseList = false;
      switchStageAnimated('slider', {
        afterSwitch() {
          try {
            rail.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        },
      });
      return true;
    }

    function destroy() {
      cancelTransitionAnimations();
      panelEl.removeEventListener('click', handlePanelClickCapture, true);
      for (const hoverType of ['mouseenter', 'mouseover', 'mousemove', 'pointerenter', 'pointerover']) {
        panelEl.removeEventListener(hoverType, handlePanelHoverCapture, true);
      }
      panelEl.removeAttribute('data-ag-me-stage');
      panelEl.removeAttribute('data-ag-me-has-list-header');
      sliderView.remove();
      listHeader.remove();
    }

    return {
      update,
      destroy,
      returnFromListToSlider,
      isInListStage: () => stage === 'list' && canReturnToSlider,
    };
  }

  let scanning = false;

  function scanPanels() {
    if (scanning) return;
    scanning = true;
    try {
      const found = doc.querySelectorAll('[data-testid="model-selector-panel"]');
      const seen = new Set();
      for (const panelEl of found) {
        seen.add(panelEl);
        let inst = panels.get(panelEl);
        if (!inst) {
          inst = createPanelInstance(panelEl);
          panels.set(panelEl, inst);
        }
        inst.update();
      }
      for (const [panelEl, inst] of panels.entries()) {
        if (!seen.has(panelEl) || !panelEl.isConnected) {
          inst.destroy();
          panels.delete(panelEl);
        }
      }
      syncActiveAttribute();
    } finally {
      scanning = false;
    }
  }

  function handleWindowKeyDown(event) {
    if (event.key !== 'Escape') return;
    for (const [panelEl, inst] of panels.entries()) {
      if (panelEl.isConnected && inst.isInListStage()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        inst.returnFromListToSlider();
        return;
      }
    }
  }

  win.addEventListener('keydown', handleWindowKeyDown, true);

  return {
    scanPanels,
    isOwnUiNode,
    getPanels: () => panels,
    destroy() {
      win.removeEventListener('keydown', handleWindowKeyDown, true);
      win.removeEventListener?.('click', handleDocClickCapture, true);
      if (suppressOutsideTimer != null && typeof win.clearTimeout === 'function') {
        win.clearTimeout(suppressOutsideTimer);
      }
      for (const inst of panels.values()) inst.destroy();
      panels.clear();
      syncActiveAttribute();
    },
  };
}

// --- entry.js ---
/**
 * model-enhancer 运行时入口：
 * 在 DOM 就绪后挂载模型面板监听与双向视图控制器。
 */
function installModelEnhancerPlugin(win = window, doc = document, iconsMap = __MODEL_ENHANCER_ICONS__) {
  if (!win || !doc || win.__myAntigravityModelEnhancerInstalled) {
    return null;
  }
  win.__myAntigravityModelEnhancerInstalled = true;

  let controller = null;
  let observer = null;

  function nodeTouchesModelPanel(node) {
    if (!node || node.nodeType !== 1) return false;
    const testId = node.getAttribute?.('data-testid');
    if (testId === 'model-selector-panel' || testId === 'orchestrator-picker-row') return true;
    if (node.closest?.('[data-testid="model-selector-panel"], [data-testid="orchestrator-picker-row"]')) {
      return true;
    }
    return Boolean(
      node.querySelector?.('[data-testid="model-selector-panel"], [data-testid="orchestrator-picker-row"]'),
    );
  }

  function initDom() {
    if (controller || !doc.body) return;
    controller = createModelEnhancerController(win, doc, iconsMap);
    controller.scanPanels();

    if (typeof win.MutationObserver === 'function') {
      observer = new win.MutationObserver((mutations) => {
        let shouldScan = false;
        for (const m of mutations) {
          if (m.type === 'attributes') {
            shouldScan = true;
            break;
          }
          if (controller.isOwnUiNode(m.target)) continue;
          if (nodeTouchesModelPanel(m.target)) {
            shouldScan = true;
            break;
          }
          for (const list of [m.addedNodes, m.removedNodes]) {
            if (!list) continue;
            for (const n of list) {
              if (nodeTouchesModelPanel(n)) {
                shouldScan = true;
                break;
              }
            }
            if (shouldScan) break;
          }
          if (shouldScan) break;
        }
        // MutationObserver 在渲染前微任务中同步执行，避免打开瞬间闪出旧列表
        if (shouldScan) {
          controller.scanPanels();
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true });
      if (doc.documentElement) {
        observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
      }
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initDom, { once: true });
  } else {
    initDom();
  }

  return {
    destroy() {
      observer?.disconnect();
      observer = null;
      controller?.destroy();
      controller = null;
      delete win.__myAntigravityModelEnhancerInstalled;
    },
  };
}

  installModelEnhancerPlugin(win, doc, __MODEL_ENHANCER_ICONS__);
})(window, document);
