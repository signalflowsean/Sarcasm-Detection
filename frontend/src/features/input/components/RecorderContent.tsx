import MicButton from './MicButton'
import Status from './Status'
import Waveform from './Waveform'
import Transcript from './Transcript'
import Controls from './Controls'

type Props = {
  isRecording: boolean
  durationLabel: string
  micRef: React.Ref<HTMLButtonElement>
  canvasRef: React.Ref<HTMLCanvasElement>
  audioRef: React.Ref<HTMLAudioElement>
  audioSrc?: string
  speechSupported: boolean
  transcript: string
  interimTranscript: string
  isPlaying: boolean
  canPlay: boolean
  canDiscard: boolean
  canSend: boolean
  sending: boolean
  showPlayhead?: boolean
  playheadPercent?: number
  isSeekEnabled?: boolean
  onSeekPercent?: (percent: number) => void
  onMicClick: () => void
  onMicKeyDown: (e: React.KeyboardEvent) => void
  onTogglePlay: () => void
  onDiscard: () => void
  onSend: () => void
}

const RecorderContent = ({
  isRecording,
  durationLabel,
  micRef,
  canvasRef,
  audioRef,
  audioSrc,
  speechSupported,
  transcript,
  interimTranscript,
  isPlaying,
  canPlay,
  canDiscard,
  canSend,
  sending,
  showPlayhead,
  playheadPercent,
  isSeekEnabled,
  onSeekPercent,
  onMicClick,
  onMicKeyDown,
  onTogglePlay,
  onDiscard,
  onSend,
}: Props) => {

  return (
    <div className="audio-recorder" aria-live="polite">
      <div className="audio-recorder__mic-wrapper">
        <MicButton ref={micRef} isRecording={isRecording} disabled={isPlaying} onClick={onMicClick} onKeyDown={onMicKeyDown} />
        <Status isRecording={isRecording} isPlaying={isPlaying} hasAudio={!!audioSrc} duration={durationLabel} />
      </div>

      <Waveform
        ref={canvasRef}
        showPlayhead={showPlayhead}
        playheadPercent={playheadPercent}
        isSeekEnabled={isSeekEnabled}
        onSeekPercent={onSeekPercent}
        showEmpty={!isRecording && !audioSrc}
        emptyMessage={"Press Down on Microphone to Record"}
      />

      <Transcript supported={speechSupported} transcript={transcript} interim={interimTranscript} />

      <Controls
        canPlay={canPlay}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onDiscard={onDiscard}
        canDiscard={canDiscard}
        onSend={onSend}
        canSend={canSend}
        sending={sending}
      />

      <audio ref={audioRef} src={audioSrc} preload="metadata" />
    </div>
  )
}

export default RecorderContent


