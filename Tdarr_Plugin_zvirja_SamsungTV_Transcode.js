/* eslint-disable */
const details = () => {
  return {
    id: "Tdarr_Plugin_zvirja_SamsungTV_Transcode",
    Stage: "Pre-processing",
    Name: "Transcode for Samsung TV",
    Type: "Any",
    Operation: "Transcode",
    Description: `[Contains built-in filter] Put preferred audio and subtitles as first track; Transcode incompatible codecs \n\n`,
    Version: "1.00",
    Tags: "samsung,audio,subtitles,ffmpeg,configurable",
    Inputs: [
      {
        name: "preferred_language",
        type: 'string',
        defaultValue: 'eng',
        inputUI: {
          type: 'text',
        },
        tooltip: `Specify one language tag for Tdarr to try and put as 1st audio & substitle track
        \\nExample:\\n
        eng 
        `,
      },
      {
        name: "audio_codecs_to_transcode",
        type: 'string',
        defaultValue: 'dts',
        inputUI: {
          type: 'text',
        },
        tooltip: `Specifiy the codecs which you'd like to transcode
        \\nExample:\\n
        eac3,ac3,aac
        `,
      },
      {
        name: "audio_target_codec",
        type: 'string',
        defaultValue: 'ac3',
        inputUI: {
          type: 'text',
        },
        tooltip: `Specify the codec you'd like to transcode into:
        \\nExample:\\n
        eac3
        `,
      },
      {
        name: "langs_to_keep",
        type: 'string',
        defaultValue: '',
        inputUI: {
          type: 'text',
        },
        tooltip: `If specified, only configured languages will be left for audio and subtitles:
        \\nExample:\\n
        eng,ukr
        `,
      }
    ],
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {
    
  const lib = require('../methods/lib')();
  inputs = lib.loadDefaultValues(inputs, details);
  
  // Must return this object
  const response = {
    processFile: false,
    preset: "",
    container: ".mkv",
    handBrakeMode: false,
    FFmpegMode: false,
    reQueueAfter: false,
    infoLog: "",
  };

  if (inputs.preferred_language === undefined || inputs.audio_target_codec === undefined || inputs.audio_codecs_to_transcode === undefined) {
    response.processFile = false;
    response.infoLog += "☒ Inputs not entered! \n";
    return response;
  }

  const preferred_language = inputs.preferred_language;
  const audio_codecs_to_transcode = inputs.audio_codecs_to_transcode.split(",");
  const audio_target_codec = inputs.audio_target_codec;
  const languages_to_keep = inputs.langs_to_keep?.split(",");

  let requireProcessing = false;
  let requireProcessingInfo = "Requires processing:"

  const audioStreams = file.ffProbeData.streams.filter(
    (stream) => stream.codec_type.toLowerCase() == "audio"
  );

  // Calculate desired audio track positions
  for (let i = 0; i < audioStreams.length; ++i) {
    const stream = audioStreams[i];

    if (!!stream.tags?.language && preferred_language.includes(stream.tags.language.toLowerCase())
    ) {
      if (i > 0) {
        requireProcessing = true;
        requireProcessingInfo += ` audio_stream_position[${stream.index}->0]`

        // Put track as first
        const [preferredTrack] = audioStreams.splice(i, 1);
        audioStreams.unshift(preferredTrack);
      }

      break;
    }
  }

  const subtitleStreams = file.ffProbeData.streams.filter(
    (stream) => stream.codec_type.toLowerCase() == "subtitle"
  );

  // Calculate desired subtitle track positions
  for (let i = 0; i < subtitleStreams.length; ++i) {
    const stream = subtitleStreams[i];

    if (!!stream.tags?.language && preferred_language.includes(stream.tags.language.toLowerCase())
    ) {
      if (i > 0) {
        requireProcessing = true;
        requireProcessingInfo += ` subtitle_stream_position[${stream.index}->0]`

        // Put track as first
        const [preferredTrack] = subtitleStreams.splice(i, 1);
        subtitleStreams.unshift(preferredTrack);
      }

      break;
    }
  }

  // Lay video streams
  let ffmpegCommand = `, -c copy  -map 0:v `;

  // Lay audio streams
  for (let i = 0; i < audioStreams.length; ++i) {
    const stream = audioStreams[i];

    if (!!languages_to_keep && !!stream.tags?.language && !languages_to_keep.includes(stream.tags.language.toLowerCase())) {
      requireProcessing = true;
      requireProcessingInfo += ` audio_stream_skip_by_lang[${stream.index},${stream.tags.language}]`
      continue;
    }

    if (!!stream.codec_name && audio_codecs_to_transcode.includes(stream.codec_name.toLowerCase())) {
      ffmpegCommand += `-map 0:${stream.index} -c:a:${i} ${audio_target_codec} `;

      requireProcessing = true;
      requireProcessingInfo += ` audio_stream_codec[${stream.index},${stream.codec_name}->${audio_target_codec}]`
    } else {
      ffmpegCommand += `-map 0:${stream.index} `;
    }

    if (i === 0) {
      ffmpegCommand += `-disposition:a:${i} default `;
    } else {
      ffmpegCommand += `-disposition:a:${i} 0 `;
    }
  }

  // Lay subtitle streams
  for (let i = 0; i < subtitleStreams.length; ++i) {
    const stream = subtitleStreams[i];

    if (!!languages_to_keep && !!stream.tags?.language && !languages_to_keep.includes(stream.tags.language.toLowerCase())) {
      requireProcessing = true;
      requireProcessingInfo += ` subtitle_stream_skip_by_lang[${stream.index},${stream.tags.language}]`
      continue;
    }

    ffmpegCommand += `-map 0:${stream.index} `;

    if (i === 0) {
      ffmpegCommand += `-disposition:s:${i} default `;
    } else {
      ffmpegCommand += `-disposition:s:${i} 0 `;
    }
  }

  // Lay rest of the streams
  ffmpegCommand += `-map 0:d? -map 0:t? `;

  if (!requireProcessing) {
    response.processFile = false;
    response.infoLog += "☒ No need to process file! \n";
    return response;
  }

  response.processFile = true;
  response.preset = ffmpegCommand;
  response.container = `.` + file.container;
  response.handBrakeMode = false;
  response.FFmpegMode = true;
  response.reQueueAfter = true;
  response.infoLog += `☒ ${requireProcessingInfo}! \n`;
  return response;
};


module.exports.details = details;
module.exports.plugin = plugin;
