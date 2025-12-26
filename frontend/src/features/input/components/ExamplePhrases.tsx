type ExamplePhrasesProps = {
  onSelect: (phrase: string) => void
  disabled?: boolean
}

const EXAMPLE_PHRASES = {
  sarcastic: [
    'Oh great, another meeting that could have been an email',
    'I just love waking up at 5am on a Monday',
    'Sure, because that makes total sense',
  ],
  sincere: [
    'Thank you for your help with this project',
    'I really enjoyed the presentation today',
    'The weather is beautiful outside',
  ],
}

const ExamplePhrases = ({ onSelect, disabled = false }: ExamplePhrasesProps) => {
  return (
    <div className="example-phrases" data-testid="example-phrases">
      <div className="example-phrases__section">
        <span className="example-phrases__label">Try a sarcastic example:</span>
        <div className="example-phrases__list">
          {EXAMPLE_PHRASES.sarcastic.map(phrase => (
            <button
              key={phrase}
              type="button"
              className="example-phrases__chip"
              onClick={() => onSelect(phrase)}
              disabled={disabled}
              aria-label={`Use example: ${phrase}`}
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
      <div className="example-phrases__section">
        <span className="example-phrases__label">Or a sincere example:</span>
        <div className="example-phrases__list">
          {EXAMPLE_PHRASES.sincere.map(phrase => (
            <button
              key={phrase}
              type="button"
              className="example-phrases__chip"
              onClick={() => onSelect(phrase)}
              disabled={disabled}
              aria-label={`Use example: ${phrase}`}
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ExamplePhrases
