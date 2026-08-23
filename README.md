<div align="center">

# 🎫 FizzyTickets

**A modern, multi-guild Discord ticket system powered by Discord.js v14 and MongoDB.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14.17-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%20v8-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Powered by](https://img.shields.io/badge/Powered%20By-FizzyStudio-blueviolet?style=for-the-badge)](https://github.com/)

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-interactive-setup-wizard">Setup Wizard</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-slash-commands">Commands</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-credits">Credits</a>
</p>

</div>

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| **Interactive `/setup` Wizard** | A visual 3-step control panel with buttons, menus, and modals. Set up the entire bot without typing arguments. |
| **Custom Question Builder** | Configure up to 5 custom modal questions per category with single-line (`SHORT`) and multi-line (`PARAGRAPH`) inputs. |
| **Interactive HTML Transcripts** | Full transcripts with messages, attachments, embeds, and avatars saved as interactive `.html` files. |
| **Concurrency & Anti-Spam** | Per-user mutex locks (`withLock`), atomic `$inc` counters, and an 800ms double-click debounce prevent race conditions. |
| **Per-Category Roles** | Assign dedicated support roles and parent Discord categories to each ticket option. |
| **Claim & Priority System** | Staff claim tickets with atomic locking, and adjust ticket urgency (`Low`, `Medium`, `High`, `Urgent`). |
| **Inactivity Monitor** | Automatic cron job sends inactivity warnings at 24 hours and closes tickets at 48 hours. |
| **Granular Feature Toggles** | Turn claiming, transcripts, reopening, priorities, or limits on and off inside `config.yml`. |

---

## 🛠️ Interactive Setup Wizard (`/setup`)

FizzyTickets replaces dozens of confusing commands with a single 3-step setup wizard:

```
[ Step 1: Server Settings ]   -->   [ Step 2: Category Builder ]   -->   [ Step 3: Deployment ]
• Ticket Limits per User            • Add / Edit Categories              • Buttons or Dropdown Mode
• Staff Mention Toggle (ON/OFF)     • Up to 5 Custom Questions           • Custom Title, Description, Color
• Admin & Support Role Select       • Category Support Roles             • One-Click Send to Any Channel
• Log Channel Select                • Discord Parent Categories
```

### How to use the wizard:
1. Type `/setup` in Discord (Admin only).
2. **Step 1**: Set max open tickets, toggle staff mention pings, and select roles and log channels.
3. **Step 2**: Click **Add Category**, enter your Name/Emoji/Description, and configure up to 5 custom modal questions.
4. **Step 3**: Pick between colored Action Buttons or a Select Menu, and choose the target channel to deploy live.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas URI)
- A Discord Bot Application with **Server Members Intent** and **Message Content Intent** enabled in the [Discord Developer Portal](https://discord.com/developers/applications).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YourUsername/FizzyTickets.git
   cd FizzyTickets
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure your bot**:
   Open `config.yml` and add your bot token, client ID, and MongoDB connection string:
   ```yaml
   bot:
     token: "YOUR_DISCORD_BOT_TOKEN"
     clientId: "YOUR_CLIENT_ID"
     mongoUri: "mongodb://127.0.0.1:27017/fizzytickets"
     embedColor: "#5865F2"
   ```

4. **Verify codebase integrity**:
   ```bash
   npm test
   ```

5. **Start the bot**:
   ```bash
   npm start
   ```

---

## 📜 Slash Commands

### Administrator Commands
| Command | Description | Permission |
| :--- | :--- | :--- |
| `/setup` | Launch the visual 3-step setup wizard (settings, categories, questions, panel deployment). | Administrator |
| `/ticket-blacklist add <user> [reason]` | Block a user from creating support tickets. | Administrator |
| `/ticket-blacklist remove <user>` | Remove a user from the ticket blacklist. | Administrator |
| `/ticket-blacklist list` | Display all blacklisted users and reasons. | Administrator |

### Staff Commands (Inside Ticket Channels)
| Command | Description | Permission |
| :--- | :--- | :--- |
| `/ticket claim` | Claim the current ticket for yourself. | Support Staff |
| `/ticket unclaim` | Release your claim so other staff can assist. | Support Staff |
| `/ticket priority <level>` | Change priority urgency (`Low`, `Medium`, `High`, `Urgent`). | Support Staff |
| `/ticket add <user>` | Add an extra user to the ticket channel. | Staff / Creator |
| `/ticket remove <user>` | Remove a user from the ticket channel. | Staff / Creator |
| `/ticket rename <name>` | Rename the ticket channel. | Support Staff |
| `/ticket close [reason]` | Close the ticket and generate an interactive HTML transcript. | Staff / Creator |
| `/ticket-stats` | View server ticket performance metrics and analytics. | Support Staff |

### General Commands
| Command | Description | Permission |
| :--- | :--- | :--- |
| `/help` | View documentation and available commands. | Everyone |
| `/ping` | Check bot latency and websocket heartbeat. | Everyone |

---

## ⚙️ Configuration (`config.yml`)

Every feature is toggleable directly through `config.yml`:

```yaml
# Bot Core Credentials
bot:
  token: "YOUR_DISCORD_BOT_TOKEN"
  clientId: "YOUR_CLIENT_ID"
  mongoUri: "mongodb://127.0.0.1:27017/fizzytickets"
  embedColor: "#5865F2"

# Feature Toggles
features:
  claiming:
    enabled: true
    allowStaffUnclaim: true
    restrictToClaimerOnly: false

  priority:
    enabled: true
    defaultPriority: "MEDIUM"

  modals:
    enabled: true
    requireSubject: true
    requireDescription: true

  transcripts:
    enabled: true
    saveHtmlLocally: false
    sendToLogChannel: true
    dmToUser: true

  inactivity:
    enabled: true
    warningAfterHours: 24
    closeAfterHours: 48
    cronSchedule: "*/10 * * * *"

  memberManagement:
    enabled: true

  reopen:
    enabled: true
    reopenWindowMinutes: 60

  ticketLimits:
    enabled: true
    maxOpenTicketsPerUser: 3

  blacklist:
    enabled: true

  cooldowns:
    enabled: true
    defaultCooldownSeconds: 15
```

---

## 🔒 Security & Concurrency

- **Race Condition Prevention**: In-memory mutex locks (`withLock`) guarantee that ticket creation, claims, close actions, and deletes execute in isolation.
- **Atomic Counter**: Ticket numbers use MongoDB `$inc` operations, ensuring no duplicate numbers during simultaneous creation.
- **Anti-Spam Debounce**: Fast double-clicks and button spam are filtered with an 800ms debounce and a 15-second creation cooldown.
- **Permission Checking**: Every interaction checks guild roles dynamically before granting access.

---

## 👥 Credits

Developed and maintained with pride by **[FizzyStudio](https://github.com/fczavian)**.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
