const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const http = require('http');

// Web sunucusu başlığı sadeleştirildi
http.createServer((req, res) => {
  res.write("Müzik Sistemi 7/24 Aktif!");
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

const SAVED_CHANNEL_ID = '1505636936163922080';
const SAVED_GUILD_ID = '1390813111195537509';

const queue = new Map();
const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play
  }
});

function connectToVoice(guild) {
  const connection = joinVoiceChannel({
    channelId: SAVED_CHANNEL_ID,
    guildId: SAVED_GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfMute: false,
    selfDeaf: true
  });
  connection.subscribe(player);
  return connection;
}

// Komut açıklamalarındaki tüm reklam ve premium yazıları kaldırıldı
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('İstediğiniz şarkıyı aratır ve çalar.').addStringOption(opt => opt.setName('şarkı').setDescription('Şarkı adı veya YouTube linki').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Sıradaki şarkıya geçer.'),
  new SlashCommandBuilder().setName('stop').setDescription('Müziği durdurur ve sırayı temizler.'),
  new SlashCommandBuilder().setName('queue').setDescription('Şarkı kuyruğunu gösterir.')
].map(c => c.toJSON());

client.on('ready', async () => {
  console.log(`${client.user.tag} hazır ve aktif!`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Komutlar başarıyla yüklendi.');
  } catch (e) { console.error(e); }

  const guild = client.guilds.cache.get(SAVED_GUILD_ID);
  if (guild) connectToVoice(guild);
});

client.on('voiceStateUpdate', (o, n) => {
  if (n.id === client.user.id && n.channelId !== SAVED_CHANNEL_ID) {
    connectToVoice(n.guild);
  }
});

async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song) return;

  try {
    const stream = await play.stream(song.url, { 
      quality: 0,
      discordPlayerCompatibility: true 
    });
    
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    player.play(resource);

    // Embed mesajı tamamen özgün ve sade hale getirildi
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎵 Şimdi Oynatılıyor')
      .setDescription(`[${song.title}](${song.url})`);
    serverQueue.textChannel?.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  }
}

player.on(AudioPlayerStatus.Idle, () => {
  for (const [guildId, serverQueue] of queue.entries()) {
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      playSong(guildId, serverQueue.songs[0]);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guildId } = interaction;
  
  let serverQueue = queue.get(guildId);
  if (!serverQueue) {
    serverQueue = { textChannel: interaction.channel, songs: [] };
    queue.set(guildId, serverQueue);
  }

  if (commandName === 'play') {
    await interaction.deferReply();
    const query = interaction.options.getString('şarkı');

    try {
      const yt_info = await play.search(query, { limit: 1 });
      if (!yt_info || yt_info.length === 0) return interaction.editReply('❌ İstediğiniz şarkı bulunamadı.');

      const song = { title: yt_info[0].title, url: yt_info[0].url };
      serverQueue.songs.push(song);

      if (serverQueue.songs.length === 1) {
        const guild = client.guilds.cache.get(SAVED_GUILD_ID);
        if (guild) connectToVoice(guild);
        await playSong(guildId, song);
        return interaction.editReply(`🚀 **${song.title}** açılıyor...`);
      } else {
        return interaction.editReply(`➕ **${song.title}** sıraya eklendi.`);
      }
    } catch (error) {
      console.error(error);
      return interaction.editReply('⚠️ Bir hata oluştu, lütfen tekrar deneyin.');
    }
  }

  if (commandName === 'skip') {
    player.stop();
    return interaction.reply('⏭️ Şarkı geçildi.');
  }

  if (commandName === 'stop') {
    serverQueue.songs = [];
    player.stop();
    return interaction.reply('⏹️ Müzik durduruldu.');
  }

  if (commandName === 'queue') {
    if (serverQueue.songs.length === 0) return interaction.reply('📜 Sıra şu an boş.');
    const list = serverQueue.songs.map((s, i) => `${i === 0 ? '▶️' : `${i}.`} ${s.title}`).join('\n');
    return interaction.reply(`📜 **Oynatılacak Şarkılar:**\n${list}`);
  }
});

client.getLog = () => {}; // Konsol izlerini temiz tutmak için ek araç
client.login(process.env.TOKEN);
