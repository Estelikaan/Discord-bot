const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const http = require('http');

// 7/24 Aktif Kalma Sunucusu
http.createServer((req, res) => {
  res.write("Muzik Sistemi Aktif!");
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
  behaviors: { noSubscriber: NoSubscriberBehavior.Play }
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

// İstediğin Tüm Özellikler Geri Eklendi (Sade ve Özgün Açıklamalarla)
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Şarkı aratır ve listeden oynatır.').addStringOption(opt => opt.setName('şarkı').setDescription('Şarkı adı veya YouTube linki').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Sıradaki şarkıya geçer.'),
  new SlashCommandBuilder().setName('stop').setDescription('Müziği tamamen durdurur ve sırayı temizler.'),
  new SlashCommandBuilder().setName('pause').setDescription('Şarkıyı geçici olarak duraklatır.'),
  new SlashCommandBuilder().setName('resume').setDescription('Duraklatılan şarkıyı devam ettirir.'),
  new SlashCommandBuilder().setName('queue').setDescription('Şarkı kuyruğunu listeler.'),
  new SlashCommandBuilder().setName('loop').setDescription('Tekrar modunu değiştirir.').addStringOption(opt => opt.setName('mod').setDescription('Tekrar modu').setRequired(true).addChoices({name:'Kapalı',value:'off'},{name:'Şarkı',value:'song'},{name:'Kuyruk',value:'queue'}))
].map(c => c.toJSON());

client.on('ready', async () => {
  console.log(`${client.user.tag} müzik sistemi aktif!`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    // Eski "Bilinmeyen Entegrasyon" komut hatalarını temizlemek için sıfırdan kaydeder
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Komutlar başarıyla güncellendi.');
  } catch (e) { console.error(e); }

  const guild = client.guilds.cache.get(SAVED_GUILD_ID);
  if (guild) connectToVoice(guild);
});

client.on('voiceStateUpdate', (o, n) => {
  if (n.id === client.user.id && n.channelId !== SAVED_CHANNEL_ID) {
    connectToVoice(n.guild);
  }
});

// Yeni ve Kararlı Şarkı Çalma Altyapısı
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song) return;

  try {
    // ytdl-core ile doğrudan yüksek performanslı ses akışı çekiyoruz
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      highWaterMark: 1 << 25, // Render'da donmaları engellemek için arabellek ayarı
      quality: 'highestaudio'
    });

    const resource = createAudioResource(stream);
    player.play(resource);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎵 Şimdi Oynatılıyor')
      .setDescription(`**${song.title}**`)
      .addFields({ name: '🔁 Döngü', value: serverQueue.loop.toUpperCase(), inline: true });
    
    serverQueue.textChannel?.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  }
}

player.on(AudioPlayerStatus.Idle, () => {
  for (const [guildId, serverQueue] of queue.entries()) {
    if (serverQueue.loop === 'song') {
      playSong(guildId, serverQueue.songs[0]);
    } else if (serverQueue.loop === 'queue') {
      const removed = serverQueue.songs.shift();
      serverQueue.songs.push(removed);
      playSong(guildId, serverQueue.songs[0]);
    } else {
      serverQueue.songs.shift();
      if (serverQueue.songs.length > 0) {
        playSong(guildId, serverQueue.songs[0]);
      }
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guildId } = interaction;
  
  let serverQueue = queue.get(guildId);
  if (!serverQueue) {
    serverQueue = { textChannel: interaction.channel, songs: [], loop: 'off' };
    queue.set(guildId, serverQueue);
  }

  if (commandName === 'play') {
    await interaction.deferReply();
    const query = interaction.options.getString('şarkı');

    try {
      // YouTube araması ve link doğrulama altyapısı
      let videoUrl = query;
      if (!ytdl.validateURL(query)) {
        const searchResults = await ytdl.getInfo(`ytsearch:${query}`);
        if (!searchResults || !searchResults.related_videos.length) {
          return interaction.editReply('❌ Aradığınız şarkı bulunamadı.');
        }
        videoUrl = searchResults.videoDetails.video_url || searchResults.related_videos[0].id;
      }

      const info = await ytdl.getBasicInfo(videoUrl);
      const song = { title: info.videoDetails.title, url: info.videoDetails.video_url };
      
      serverQueue.songs.push(song);

      if (serverQueue.songs.length === 1) {
        const guild = client.guilds.cache.get(SAVED_GUILD_ID);
        if (guild) connectToVoice(guild);
        await playSong(guildId, song);
        return interaction.editReply(`🚀 **${song.title}** oynatılıyor.`);
      } else {
        return interaction.editReply(`➕ **${song.title}** kuyruğa eklendi. (Sıra: ${serverQueue.songs.length - 1})`);
      }
    } catch (error) {
      console.error(error);
      return interaction.editReply('⚠️ Şarkı başlatılırken hata oluştu. Lütfen tekrar deneyin.');
    }
  }

  if (commandName === 'skip') {
    player.stop();
    return interaction.reply('⏭️ Sıradaki şarkıya geçildi.');
  }

  if (commandName === 'stop') {
    serverQueue.songs = [];
    player.stop();
    return interaction.reply('⏹️ Müzik durduruldu ve kuyruk sıfırlandı.');
  }

  if (commandName === 'pause') {
    player.pause();
    return interaction.reply('⏸️ Müzik geçici olarak duraklatıldı.');
  }

  if (commandName === 'resume') {
    player.unpause();
    return interaction.reply('▶️ Müzik devam ettiriliyor.');
  }

  if (commandName === 'loop') {
    const mode = interaction.options.getString('mod');
    serverQueue.loop = mode;
    return interaction.reply(`🔁 Döngü modu **${mode.toUpperCase()}** olarak ayarlandı.`);
  }

  if (commandName === 'queue') {
    if (serverQueue.songs.length === 0) return interaction.reply('📜 Kuyruk şu an boş.');
    const list = serverQueue.songs.map((s, i) => `${i === 0 ? '▶️' : `${i}.`} ${s.title}`).slice(0, 10).join('\n');
    return interaction.reply(`📜 **Güncel Şarkı Listesi:**\n${list}`);
  }
});

client.login(process.env.TOKEN);
