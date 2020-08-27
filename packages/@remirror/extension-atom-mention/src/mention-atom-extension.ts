import {
  ApplySchemaAttributes,
  extensionDecorator,
  ExtensionTag,
  FromToParameter,
  Handler,
  isElementDomNode,
  kebabCase,
  NodeAttributes,
  NodeExtension,
  NodeExtensionSpec,
  pick,
  replaceText,
  Static,
} from '@remirror/core';
import {
  DEFAULT_SUGGESTER,
  RangeWithCursor,
  SuggestChangeHandler,
  Suggester,
  SuggestReplacementType,
} from '@remirror/pm/suggest';

/**
 * The static settings passed into a mention
 */
export interface MentionAtomOptions {
  /**
   * Provide a custom tag for the mention
   */
  mentionTag?: Static<string>;

  /**
   * Provide the custom matchers that will be used to match mention text in the
   * editor.
   */
  matchers: Static<MentionAtomExtensionMatcher[]>;

  /**
   * Text to append after the mention has been added.
   *
   * **NOTE**: If it seems that your editor is swallowing  up empty whitespace,
   * make sure you've imported the core css from the `@remirror/styles` library.
   *
   * @default ' '
   */
  appendText?: string;

  /**
   * Tag for the prosemirror decoration which wraps an active match.
   *
   * @default 'span'
   */
  suggestTag?: string;

  /**
   * When true, decorations are not created when this mention is being edited.
   */
  noDecorations?: boolean;

  /**
   * Called whenever a suggestion becomes active or changes in any way.
   *
   * @remarks
   *
   * It receives a parameters object with the `reason` for the change for more
   * granular control.
   */
  onChange: Handler<SuggestChangeHandler>;
}

/**
 * This is the node version of the already popular
 * `@remirror/extension-mention`. It provides mentions as atom nodes with many
 */
@extensionDecorator<MentionAtomOptions>({
  defaultOptions: {
    mentionTag: 'span' as const,
    matchers: [],
    appendText: ' ',
    suggestTag: 'span' as const,
    noDecorations: false,
  },
  handlerKeys: ['onChange'],
  staticKeys: ['matchers', 'mentionTag'],
})
export class MentionAtomExtension extends NodeExtension<MentionAtomOptions> {
  get name() {
    return 'mentionAtom' as const;
  }

  readonly tags = [ExtensionTag.InlineNode, ExtensionTag.Behavior];

  createNodeSpec(extra: ApplySchemaAttributes): NodeExtensionSpec {
    const dataAttributeId = 'data-mention-atom-id';
    const dataAttributeName = 'data-mention-atom-name';

    return {
      attrs: {
        ...extra.defaults(),
        id: {},
        label: {},
        name: {},
      },
      inline: true,
      selectable: false,
      atom: true,

      parseDOM: [
        {
          tag: `${this.options.mentionTag}[${dataAttributeId}]`,
          getAttrs: (node) => {
            if (!isElementDomNode(node)) {
              return false;
            }

            const id = node.getAttribute(dataAttributeId);
            const name = node.getAttribute(dataAttributeName);
            const label = node.textContent;
            return { ...extra.parse(node), id, label, name };
          },
        },
      ],
      toDOM: (node) => {
        const { label, id, name, replacementType, range, ...attributes } = node.attrs as Required<
          MentionAtomExtensionAttributes
        >;
        const matcher = this.options.matchers.find((matcher) => matcher.name === name);

        const mentionClassName = matcher
          ? matcher.mentionClassName ?? DEFAULT_MATCHER.mentionClassName
          : DEFAULT_MATCHER.mentionClassName;

        return [
          this.options.mentionTag,
          {
            ...extra.dom(node),
            ...attributes,
            class: name
              ? `${mentionClassName} ${mentionClassName}-${kebabCase(name)}`
              : mentionClassName,
            [dataAttributeId]: id,
            [dataAttributeName]: name,
          },
          label,
        ];
      },
    };
  }

  createCommands() {
    return {
      /**
       * Creates a  new range at the provided range.
       */
      createMentionAtom: (range: FromToParameter, attrs: MentionAtomExtensionAttributes) => {
        return replaceText({ type: this.type, appendText: this.options.appendText, attrs, range });
      },
    };
  }

  createSuggesters(): Suggester[] {
    return this.options.matchers.map<Suggester>((matcher) => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const extension = this;

      return {
        ...DEFAULT_MATCHER,
        ...matcher,

        // The following properties are provided as getter so that the
        // prosemirror-suggest plugin always references the latest version of
        // the suggestion. This is not a good idea and should be fixed in a
        // better way soon.
        get noDecorations() {
          return extension.options.noDecorations;
        },

        get suggestTag() {
          return extension.options.suggestTag;
        },

        onChange: this.options.onChange,
      };
    });
  }
}

/**
 * The default matcher to use when none is provided in options
 */
const DEFAULT_MATCHER = {
  ...pick(DEFAULT_SUGGESTER, [
    'startOfLine',
    'supportedCharacters',
    'validPrefixCharacters',
    'invalidPrefixCharacters',
    'appendText',
    'suggestClassName',
  ]),
  appendText: ' ',
  matchOffset: 1,
  mentionClassName: 'mention',
};

export interface OptionalMentionAtomExtensionParameter {
  /**
   * The text to append to the replacement.
   *
   * @default ''
   */
  appendText?: string;

  /**
   * The type of replacement to use. By default the command will only replace text up the the cursor position.
   *
   * To force replacement of the whole match regardless of where in the match the cursor is placed set this to
   * `full`.
   *
   * @default 'full'
   */
  replacementType?: SuggestReplacementType;

  /**
   * The name of the matched char
   */
  name?: string;

  /**
   * The range of the requested selection.
   */
  range?: RangeWithCursor;
}

/**
 * The attrs that will be added to the node.
 * ID and label are plucked and used while attributes like href and role can be assigned as desired.
 */
export type MentionAtomExtensionAttributes = NodeAttributes<
  OptionalMentionAtomExtensionParameter & {
    /**
     * A unique identifier for the suggesters node
     */
    id: string;

    /**
     * The text to be placed within the suggesters node
     */
    label: string;
  }
>;

/**
 * The options for the matchers which can be created by this extension.
 */
export interface MentionAtomExtensionMatcher
  extends Pick<
    Suggester,
    | 'char'
    | 'name'
    | 'startOfLine'
    | 'supportedCharacters'
    | 'validPrefixCharacters'
    | 'invalidPrefixCharacters'
    | 'appendText'
    | 'suggestClassName'
  > {
  /**
   * See [[``Suggester.matchOffset`]] for more details.
   *
   * @default 1
   */
  matchOffset?: number;

  /**
   * Provide customs class names for the completed mention.
   */
  mentionClassName?: string;
}
