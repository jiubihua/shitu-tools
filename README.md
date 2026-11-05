# 拾图工具

两个各自独立的工具：拾图 Chrome 扩展，以及小红书网页上的 Eagle 收藏脚本。

| 工具 | 当前版本 | 安装与更新 |
|---|---|---|
| 拾图 Chrome 扩展 | 1.7.0 | [下载最新安装包](https://github.com/jiubihua/shitu-tools/raw/refs/heads/main/downloads/shitu-chrome.zip) |
| Eagle 小红书收藏脚本 | 1.6.2 | [安装或更新脚本](https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.user.js) |

## 拾图 Chrome 扩展

从当前小红书笔记提取图片及视频；视频悬停静音播放、移出暂停，画面保持原比例。界面跟随系统浅色和深色外观。图片转换为 JPG，视频保存为 MP4，批量写入所选系统目录。创建笔记文件夹、生成 TXT 清单是两个独立选项。

### 首次安装

1. [下载拾图 Chrome 最新安装包](https://github.com/jiubihua/shitu-tools/raw/refs/heads/main/downloads/shitu-chrome.zip)，解压得到 `xhs-image-tool` 文件夹。
2. 把文件夹放在一个固定位置。不要直接从 ZIP 内加载，也不要放在稍后会清理的临时目录中。
3. 在 Chrome 地址栏输入 `chrome://extensions` 并打开，开启右上角的“开发者模式”。
4. 点击“加载未打包的扩展程序”（部分版本显示“加载已解压的扩展程序”），选中 **包含 `manifest.json` 的 `xhs-image-tool` 文件夹**。
5. 确认扩展卡片显示“拾图 · 小红书图片助手”、版本 **1.7.0**，且开关已开启。
6. 点击 Chrome 工具栏的拼图形状“扩展程序”按钮，在拾图旁点击图钉，固定到工具栏。
7. 打开或刷新小红书笔记详情页，点击工具栏中的拾图，即可提取图片和视频。

### 更新已安装的拾图

1. 下载并解压同一个[最新安装包](https://github.com/jiubihua/shitu-tools/raw/refs/heads/main/downloads/shitu-chrome.zip)。
2. 把新 `xhs-image-tool` 文件夹内的**全部文件**复制到原来加载的插件目录，选择替换。原目录可以是你自行命名的文件夹。
3. 打开 `chrome://extensions`，找到拾图，点击卡片上的 **↻ 重新加载**。
4. 检查版本，再刷新小红书页面。

通常不需要先移除插件再安装。不要把新版文件夹套在旧文件夹里面：原目录第一层仍应能直接看到 `manifest.json`。

**目前尚未发布到 Chrome 应用商店。**本仓库提供的是开发者模式安装包，不会仅凭 GitHub URL 自动安装新版；扩展管理页顶部的“更新”也不能替代上述文件替换步骤。以后若上架商店，会在这里补充正式商店链接。

### 使用

- 打开笔记后点击拾图，确认提取结果；勾选素材，再点击“保存”。
- 系统弹出文件夹选择框后，选择保存位置并允许写入，一次选择即可批量保存独立文件。
- “创建笔记文件夹”和“生成 TXT 清单”分别控制目录及清单，两个选项各自记忆。
- 视频预览：鼠标移入播放、移出暂停，默认静音，完整保持画面比例。
- 视频无法提取时，可先在笔记内播放一次，再点击“重新提取”。

### 常见问题

- **工具栏没有拾图**：先在 `chrome://extensions` 确认已启用，再在拼图菜单中固定它。
- **扩展列表也没有拾图**：按“首次安装”重新加载插件文件夹。
- **移动或删除目录后失效**：把插件目录放回原位后重新加载；若原目录已丢失，重新下载并加载新目录。
- **提示找不到清单文件**：选错了文件夹；应选择直接包含 `manifest.json` 的那一级。
- **不显示新版功能**：确认已替换全部文件，点击卡片上的“重新加载”，然后刷新小红书页面。

## Eagle 小红书脚本

需要已安装 Tampermonkey，且本机 Eagle 已运行并打开资源库。按钮在笔记素材左上角悬停显示，菜单默认收起。可以收藏当前素材、批量图片或视频，并选择或新建 Eagle 文件夹。

### 首次安装

1. 在 Chrome 中安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/)，按照其页面提示完成启用。
2. 安装并打开 Eagle 桌面软件，载入要保存素材的资源库。
3. 点击 [Eagle 脚本安装链接](https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.user.js)。
4. 在 Tampermonkey 打开的页面中确认名称为“Eagle 小红书网页适配（无界面）”、版本 **1.6.2**，检查内容后点击“安装”。旧名称用于识别和覆盖已有版本，实际包含收藏按钮。
5. 打开 Tampermonkey 管理面板，确认脚本开关已开启。
6. 打开或刷新小红书笔记，鼠标移到图片或视频**左上角**，显示“收藏到 Eagle”按钮。点击右侧箭头可展开批量收藏及文件夹选项。
7. 选择要收藏的素材及 Eagle 文件夹，再确认存入。这里选的是 Eagle 资源库内的文件夹，不是系统访达目录。

### 从本地旧版切换到 URL 更新

1. 点击同一个 [Eagle 脚本安装／更新链接](https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.user.js)。
2. Tampermonkey 会识别相同名称及 namespace，并显示“更新用户脚本”。核对更新来源属于 `jiubihua/shitu-tools`。
3. 点击“更新”，返回管理面板确认仅启用一个同名脚本，版本为 **1.6.2**。
4. 刷新小红书页面。

1.6.2 配置了固定的 `@updateURL`（版本元数据）和 `@downloadURL`（完整脚本）。从本地文件安装的旧版需要先执行上面的切换步骤，才会获得在线更新地址。

### 以后如何更新

- Tampermonkey 可按照其设置的检查周期获取 GitHub 新版；不是一上传就保证立即更新。
- 需要立即检查时，在 Tampermonkey 管理面板中对该脚本执行“检查更新”，或再次打开上面的安装／更新链接。
- 更新完成后刷新小红书页面。若新版新增权限，按 Tampermonkey 提示核对并确认。
- 如果没有出现收藏按钮，先确认脚本已启用、Tampermonkey 未提示缺少用户脚本运行许可，并且已打开具体笔记详情。
- 无法连接 Eagle 时，确认桌面软件已运行并载入资源库。

脚本和元数据的固定地址分别为：

- [完整用户脚本](https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.user.js)
- [更新元数据](https://raw.githubusercontent.com/jiubihua/shitu-tools/main/eagle/eagle-xhs.meta.js)

## 发布规则

所有修改先在本地完成并验证，向工具所有者展示版本、改动及测试结果，得到本次明确确认后才上传和发布。禁止将“修改好了”“继续测试”视为发布授权。发布文件上传完成后再检查线上版本及安装链接。

Chrome 扩展和 Eagle 脚本独立编号；只修改一项时，不必提高另一项版本。仓库中不包含用户保存的笔记、图片、视频、账号凭据或身份验证信息。

## 目录

- `chrome/`：Chrome 扩展的完整源文件。
- `eagle/`：Eagle 用户脚本及更新元数据。
- `downloads/`：可直接下载的 Chrome 安装包。
- `versions.json`：发布版本及固定链接。

## 本次发布

- Chrome 1.7.0：已有视频悬停预览、比例保持及系统主题适配；本次托管至 GitHub。
- Eagle 1.6.2：沿用 1.6.1 的左上角入口和半透明界面，新增 GitHub 更新与下载地址，权限不变。

Chrome 本地预览与模拟测试已通过；Eagle 已通过位置、菜单、输入与模拟接口测试。小红书页面结构、媒体有效期和网络限制可能影响实际素材读取。
