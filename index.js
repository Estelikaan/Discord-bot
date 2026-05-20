const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const http = require('http');

// Render'ın kapanmasını önleyen basit web sunucusu
http.createServer((req, res) => {
  res.write("7/24 AFK Sistemi Aktif!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const SAVED_CHANNEL_ID = '1505636936163922080';
const SAVED_GUILD_ID = '1390813111195537509';

function connectToVoice(guild) {
  try {
    joinVoiceChannel({
      channelId: SAVED_CHANNEL_ID,
      guildId: SAVED_GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: true, // Mikrofon kapalı
      selfDeaf: true  // Kulaklık kapalı (Sağırlaştırılmış)
    });
    console.log("Bot belirlenen kanala AFK olarak giriş yaptı.");
  } catch (error) {
    console.error("Bağlantı hatası:", error);
  }
}

client.on('ready', () => {
  console.log(`${client.user.tag} hazır ve 7/24 moduna geçiş yaptı.`);
  
  const guild = client.guilds.cache.get(SAVED_GUILD_ID);
  if (guild) connectToVoice(guild);
});

// Birisi botu odadan atarsa veya kanal değişirse otomatik geri girer
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.id === client.user.id && newState.channelId !== SAVED_CHANNEL_ID) {
    connectToVoice(newState.guild);
  }
});

client.login(process.env.TOKEN);
