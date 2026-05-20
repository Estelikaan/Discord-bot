const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const http = require('http');

// 7/24 Kesintisiz Aktiflik Web Sunucusu
http.createServer((req, res) => {
  res.write("Musico Ultra Premium 7/24 Aktif!");
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

// Gelişmiş Kuyruk ve Premium Bellek Yönetimi
const queue = new Map();
const player = createAudioPlayer();

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

// Tüm Musico Premium Komutlarının Tanımlanması
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('🎵 Şarkı veya oynatma listesi (YouTube/Spotify) oynatır.').addStringOption(opt => opt.setName('şarkı').setDescription('Şarkı adı veya Link').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('⏭️ Sıradaki şarkıya geçer.'),
  new SlashCommandBuilder().setName('stop').setDescription('⏹️ Müziği tamamen durdurur ve kuyruğu temizler.'),
  new SlashCommandBuilder().setName('pause').setDescription('⏸️ Şarkıyı geçici olarak duraklatır.'),
  new SlashCommandBuilder().setName('resume').setDescription('▶️ Duraklatılan şarkıyı devam ettirir.'),
  new SlashCommandBuilder().setName('queue').setDescription('📜 Gelişmiş şarkı kuyruğunu listeler.'),
  new SlashCommandBuilder().setName('loop').setDescription('🔁 Tekrar modunu değiştirir (Kapalı/Şarkı/Kuyruk)').addStringOption(opt => opt.setName('mod').setDescription('Tekrar modu').setRequired(true).addChoices({name:'Kapalı',value:'off'},{name:'Şarkı',value:'song'},{name:'Kuyruk',value:'queue'})),
  new SlashCommandBuilder().setName('volume').setDescription('🔊 [PREMIUM] Ses düzeyini ayarlar (1-200).').addIntegerOption(opt => opt.setName('yüzde').setDescription('Ses seviyesi').setRequired(true)),
  new SlashCommandBuilder().setName('nowplaying').setDescription('ℹ️ Şu an çalan şarkının detaylarını gösterir.'),
  new SlashCommandBuilder().setName('autoplay').setDescription('📻 [PREMIUM] Benzer şarkıları otomatik oynatmayı açar/kapatır.')
].map(c => c.toJSON());

client.on('ready', async () => {
  console.log(`${client.user.tag} Musico Ultra Premium Modu Aktif!`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Tüm Premium (/) komutları Discord\'a başarıyla işlendi.');
  } catch (e) { console.error(e); }

  const guild = client.guilds.cache.get(SAVED_GUILD_ID);
  if (guild) connectToVoice(guild);
});

// Koruma Satırı
client.on('voiceStateUpdate', (o, n) => {
  if (n.id === client.user.id && n.channelId !== SAVED_CHANNEL_ID) {
    connectToVoice(n.guild);
  }
});

// Şarkı Oynatma Motoru (Premium Altyapı)
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song) {
    if (serverQueue && serverQueue.autoplay) {
      // Otomatik oynatma özelliği aktifse benzer şarkı bulup çalar
      const nextSongs = await play.search(serverQueue.lastSearch || 'turkce rock', { limit: 2 });
      if (nextSongs[1]) {
        serverQueue.songs.push({ title: nextSongs[1].title, url: nextSongs[1].url });
        return playSong(guildId, serverQueue.songs[0]);
      }
    }
    return;
  }

  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
    resource.volume.setVolume(serverQueue.volume / 100);
    
    player.play(resource);
    serverQueue.currentResource = resource;

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎵 Şimdi Çalıyor (Ultra Premium)')
      .setDescription(`[${song.title}](${song.url})`)
      .addFields(
        { name: '🔊 Ses', value: `%${serverQueue.volume}`, inline: true },
        { name: '🔁 Döngü', value: serverQueue.loop.toUpperCase(), inline: true }
      );
    serverQueue.textChannel?.send({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  }
}

player.on(AudioPlayerStatus.Idle, () => {
  // Döngü ve Sıra Mantığı
  for (const [guildId, serverQueue] of queue.entries()) {
    if (serverQueue.loop === 'song') {
      playSong(guildId, serverQueue.songs[0]);
    } else if (serverQueue.loop === 'queue') {
      const removed = serverQueue.songs.shift();
      serverQueue.songs.push(removed);
      playSong(guildId, serverQueue.songs[0]);
    } else {
      serverQueue.songs.shift();
      playSong(guildId, serverQueue.songs[0]);
    }
  }
});

// Komut İşleme Merkezi
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guildId } = interaction;
  
  let serverQueue = queue.get(guildId);
  if (!serverQueue) {
    serverQueue = { textChannel: interaction.channel, songs: [], volume: 100, loop: 'off', autoplay: false, lastSearch: '' };
    queue.set(guildId, serverQueue);
  }

  if (commandName === 'play') {
    await interaction.deferReply();
    const query = interaction.options.getString('şarkı');
    serverQueue.lastSearch = query;

    const yt_info = await play.search(query, { limit: 1 });
    if (!yt_info || yt_info.length === 0) return interaction.editReply('❌ Şarkı bulunamadı.');

    const song = { title: yt_info[0].title, url: yt_info[0].url };
    serverQueue.songs.push(song);

    if (serverQueue.songs.length === 1) {
      const guild = client.guilds.cache.get(SAVED_GUILD_ID);
      if (guild) connectToVoice(guild);
      playSong(guildId, song);
      return interaction.editReply(`🚀 **${song.title}** başarıyla açıldı.`);
    } else {
      return interaction.editReply(`➕ **${song.title}** sıraya eklendi. (Sıra: ${serverQueue.songs.length - 1})`);
    }
  }

  if (commandName === 'skip') {
    player.stop();
    return interaction.reply('⏭️ Şarkı başarıyla geçildi.');
  }

  if (commandName === 'stop') {
    serverQueue.songs = [];
    player.stop();
    return interaction.reply('⏹️ Müzik tamamen durduruldu ve kuyruk temizlendi.');
  }

  if (commandName === 'pause') {
    player.pause();
    return interaction.reply('⏸️ Müzik duraklatıldı.');
  }

  if (commandName === 'resume') {
    player.unpause();
    return interaction.reply('▶️ Müzik devam ettiriliyor.');
  }

  if (commandName === 'volume') {
    const vol = interaction.options.getInteger('yüzde');
    if (vol < 1 || vol > 200) return interaction.reply('❌ Ses seviyesi 1 ile 200 arasında olmalıdır.');
    serverQueue.volume = vol;
    if (serverQueue.currentResource) serverQueue.currentResource.volume.setVolume(vol / 100);
    return interaction.reply(`🔊 Ses seviyesi **%${vol}** olarak ayarlandı. [PREMIUM]`);
  }

  if (commandName === 'loop') {
    const mode = interaction.options.getString('mod');
    serverQueue.loop = mode;
    return interaction.reply(`🔁 Döngü modu **${mode.toUpperCase()}** olarak güncellendi.`);
  }

  if (commandName === 'autoplay') {
    serverQueue.autoplay = !serverQueue.autoplay;
    return interaction.reply(`📻 Otomatik oynatma (Benzer şarkılar) **${serverQueue.autoplay ? 'AÇIK' : 'KAPALI'}** konumuna getirildi. [PREMIUM]`);
  }

  if (commandName === 'queue') {
    if (serverQueue.songs.length === 0) return interaction.reply('📜 Şu an sıra boş.');
    const list = serverQueue.songs.map((s, i) => `${i === 0 ? '▶️' : `${i}.`} ${s.title}`).slice(0, 10).join('\n');
    return interaction.reply(`📜 **Güncel Şarkı Kuyruğu:**\n${list}`);
  }

  if (commandName === 'nowplaying') {
    if (serverQueue.songs.length === 0) return interaction.reply('❌ Şu an hiçbir şey çalmıyor.');
    return interaction.reply(`ℹ️ **Şu An Çalan:** ${serverQueue.songs[0].title}\nLink: ${serverQueue.songs[0].url}`);
  }
});

client.login(process.env.TOKEN);
