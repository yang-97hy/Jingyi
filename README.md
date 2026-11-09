# 鲸忆

陪伴型 AI 的记忆与情绪层。纯 node 脚本，无第三方依赖。

## 安装

Windows：双击 `一键安装.bat`
其它：`node scripts/install.mjs`

装完会建好记忆库、写好配置、注册开机自启、起守护进程、跑一遍自检。

## 交给 DSH

把本目录放进工作区，对它说：**"读 AGENTS.md，照它装好。"**

## 接入你自己的框架

见 `docs/接入钩子.md`（三个钩子 + 两个时机）。
接口清单见 `docs/接口.md`，路径与定时见 `docs/部署.md`。

## 脚本

| 脚本 | 干什么 |
|---|---|
| install.mjs | 一键安装 |
| init.mjs | 只建记忆库 |
| supervisor.mjs | 常驻：网关看门狗 / 每日维护 / 增量归档 |
| pre-rotate.mjs | 换会话前的闸门（没落盘就不换） |
| archive-full.mjs / archive-incremental.mjs | 归档（全文 + 思考 + 按人分开） |
| mem-health.mjs | 记忆体检（覆盖率/情绪/超长） |
| make-exam.mjs / exam-score.mjs | 闭卷考出题与评分 |
| tone-profile.mjs | 语域档案初稿 |
| recall-emotion.mjs | 情绪加权检索 |
| hormones.mjs | 情绪数值 |
| silly-check.mjs | 挑可疑记忆条目 |
| probe-env.mjs / doctor.mjs | 框架探测 / 环境自检 |

## 许可

MIT
