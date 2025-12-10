import type { SpeechStatus } from '../hooks/useSpeechRecognition'
import Controls from './Controls'
import MicButton from './MicButton'
import SharedTextArea from './SharedTextArea'
import Status from './Status'
import Waveform from './Waveform'

type Props = {
  isRecording: boolean
  shouldFlashMic: boolean
  durationLabel: string
  micRef: React.Ref<HTMLButtonElement>
  canvasRef: React.Ref<HTMLCanvasElement>
  audioRef: React.Ref<HTMLAudioElement>
  audioSrc?: string
  speechStatus: SpeechStatus
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
  shouldFlashMic,
  durationLabel,
  micRef,
  canvasRef,
  audioRef,
  audioSrc,
  speechStatus,
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
  // Speech is available if status isn't 'unsupported' (covers both API not existing and API not working)
  const speechAvailable = speechStatus !== 'unsupported'

  const transcriptDescriptionId = 'transcript-description'
  const transcriptDescription = speechAvailable
    ? 'Transcript area: Speech-to-text is available. When you record audio by pressing the microphone button, your speech will be automatically transcribed and displayed here in real-time.'
    : 'Transcript area: Speech-to-text is not supported in this browser. Audio will be recorded, but automatic transcription is unavailable.'

  return (
    <div className="audio-recorder" aria-live="polite" data-testid="audio-recorder">
      <div className="audio-recorder__mic-wrapper">
        <MicButton
          ref={micRef}
          isRecording={isRecording}
          shouldFlash={shouldFlashMic}
          disabled={isPlaying || sending}
          onClick={onMicClick}
          onKeyDown={onMicKeyDown}
        />
        <Status
          isRecording={isRecording}
          isPlaying={isPlaying}
          hasAudio={!!audioSrc}
          duration={durationLabel}
        />
      </div>

      <Waveform
        ref={canvasRef}
        showPlayhead={showPlayhead}
        playheadPercent={playheadPercent}
        isSeekEnabled={isSeekEnabled}
        onSeekPercent={onSeekPercent}
        showEmpty={!isRecording && !audioSrc}
        emptyMessage={'Press Down on Microphone to Record'}
      />

      {/* Visually hidden description for screen readers */}
      <div
        id={transcriptDescriptionId}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {transcriptDescription}
      </div>

      <SharedTextArea
        value={(transcript + ' ' + interimTranscript).trim()}
        placeholder={
          speechAvailable ? 'Speak to transcribe…' : 'Speech-to-text not supported in this browser.'
        }
        disabled={true}
        className="audio-recorder__transcript"
        rows={2}
        aria-describedby={transcriptDescriptionId}
        aria-label="Speech transcript"
      />

      <Controls
        canPlay={canPlay && !sending}
        isPlaying={isPlaying}
        isRecording={isRecording}
        onTogglePlay={onTogglePlay}
        onDiscard={onDiscard}
        canDiscard={canDiscard && !sending}
        onSend={onSend}
        canSend={canSend}
        sending={sending}
      />

      <audio ref={audioRef} src={audioSrc} preload="metadata" />
    </div>
  )
}

export default RecorderContent
