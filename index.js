const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const http = require('http');

// Render'ın uyanık kalması için web sunucusu
http.createServer((req, res) => {
  res.write("Bot 7/24 Aktif!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Sabit kalmasını istediğin kanal ve sunucu ID'leri
const SAVED_CHANNEL_ID = '1505636936163922080';
const SAVED_GUILD_ID = '1390813111195537509';

// Sese bağlanma fonksiyonu
function connectToVoice(guild) {
  joinVoiceChannel({
    channelId: SAVED_CHANNEL_ID,
    guildId: SAVED_GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfMute: true,
    selfDeaf: true
  });
}

client.on('ready', () => {
  console.log(`${client.user.tag} aktif ve sese bağlanmaya hazır!`);
  const guild = client.guilds.cache.get(SAVED_GUILD_ID);
  if (guild) {
    connectToVoice(guild);
    console.log("Ses kanalına giriş yapıldı.");
  }
});

// KORUMA SATIRI: Bot başka kanala taşınırsa anında eski yerine geri döner
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.id === client.user.id) {
    // Eğer bot hedef kanaldan farklı bir kanala taşındıysa veya çıkarıldıysa
    if (newState.channelId !== SAVED_CHANNEL_ID) {
      console.log("Bot başka kanala taşındı! Eski kanalına geri döndürülüyor...");
      connectToVoice(newState.guild);
    }
  }
});

client.login(process.env.TOKEN);
