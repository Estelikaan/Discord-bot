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

client.on('ready', () => {
  console.log(`${client.user.tag} aktif ve sese bağlanmaya hazır!`);
  
  // Discord'da sağ tıklayıp aldığın ID'leri buraya yazacaksın
  const channelId = '1505636936163922080';
  const guildId = '1390813111195537509';

  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    joinVoiceChannel({
      channelId: channelId,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });
    console.log("Ses kanalına başarıyla giriş yapıldı.");
  }
});

client.login(process.env.TOKEN);