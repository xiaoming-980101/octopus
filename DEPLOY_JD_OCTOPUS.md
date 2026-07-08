# Octopus GitHub 自动部署到京东云

这份文档用于把 Octopus 接入 GitHub Actions 自动部署：

```text
git push origin dev/main
        |
        v
GitHub Actions
        |
        |-- 构建 Next.js 静态前端
        |-- 移动到 static/out 并嵌入 Go 二进制
        |-- 构建 Linux amd64/arm64 二进制
        |-- SSH 上传到京东云 /tmp
        |-- 发布到 /opt/octopus/releases/<sha>
        |-- 更新 /opt/octopus/current
        |-- 写入/更新 systemd service
        |-- restart octopus
        |-- curl smoke test
```

Workflow 文件：

```text
.github/workflows/deploy-jd-octopus.yml
```

## 一、服务器准备

默认部署目录是：

```bash
/opt/octopus
```

首次在京东云服务器执行：

```bash
mkdir -p /opt/octopus/data /opt/octopus/releases /var/backups/octopus
```

如果你使用默认端口 `8080`，京东云安全组需要放行：

```text
8080/TCP
```

Octopus 首次启动会自动生成：

```text
/opt/octopus/data/config.json
```

默认管理账号：

```text
admin / admin
```

首次登录后请立即修改密码。

## 二、GitHub Secrets

进入 GitHub 仓库：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

必填：

```text
JD_HOST=服务器公网 IP
JD_SSH_PASSWORD=服务器 SSH 密码
```

推荐填写：

```text
JD_PORT=22
JD_USER=root
JD_APP_DIR=/opt/octopus
JD_SERVICE_NAME=octopus
JD_PUBLIC_URL=http://服务器公网IP:8080
JD_HOST_FINGERPRINT=SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OCTOPUS_SERVER_PORT=8080
JD_TARGET_ARCH=amd64
```

说明：

| Secret | 作用 | 默认值 |
| --- | --- | --- |
| `JD_HOST` | 服务器 IP 或域名 | 必填 |
| `JD_SSH_PASSWORD` | SSH 密码 | 必填 |
| `JD_PORT` | SSH 端口 | `22` |
| `JD_USER` | SSH 用户 | `root` |
| `JD_APP_DIR` | Octopus 发布目录 | `/opt/octopus` |
| `JD_SERVICE_NAME` | systemd 服务名 | `octopus` |
| `JD_PUBLIC_URL` | smoke test 地址 | `http://JD_HOST:OCTOPUS_SERVER_PORT` |
| `JD_HOST_FINGERPRINT` | SSH 主机指纹校验 | 空则只使用 ssh-keyscan |
| `OCTOPUS_SERVER_PORT` | Octopus 服务端口 | `8080` |
| `JD_TARGET_ARCH` | 服务器架构，`amd64` 或 `arm64` | `amd64` |

获取 SSH 主机指纹：

```powershell
ssh-keyscan -p 22 服务器公网IP | ssh-keygen -lf - -E sha256
```

把输出里的 `SHA256:...` 填入 `JD_HOST_FINGERPRINT`。

## 三、触发部署

自动触发：

```bash
git push origin dev
```

或：

```bash
git push origin main
```

手动触发：

```text
GitHub -> Actions -> Deploy JD Cloud Octopus -> Run workflow
```

如果服务器是 ARM64，手动触发时选择 `arm64`，或者设置：

```text
JD_TARGET_ARCH=arm64
```

## 四、服务器验证

查看服务状态：

```bash
systemctl status octopus --no-pager
```

查看日志：

```bash
journalctl -u octopus -f
```

确认端口监听：

```bash
ss -ltnp | grep 8080
```

访问：

```text
http://服务器公网IP:8080
```

## 五、回滚

每次部署都会保留最近 5 个 release：

```bash
ls -la /opt/octopus/releases
```

回滚到指定 release：

```bash
target=/opt/octopus/releases/要回滚的SHA
ln -sfn "$target" /opt/octopus/current
systemctl restart octopus
```

旧二进制备份在：

```text
/var/backups/octopus
```

## 六、注意事项

- `/opt/octopus/data` 是持久化目录，部署不会覆盖它。
- Workflow 限制 `JD_APP_DIR` 必须位于 `/opt/octopus` 下，避免 Secret 写错后覆盖系统目录。
- 如果你用 Nginx 反代到 80/443，`JD_PUBLIC_URL` 可以填域名，`OCTOPUS_SERVER_PORT` 仍保持 Octopus 实际监听端口。
- 生产环境建议后续改成 SSH key 登录，并关闭服务器密码登录。
