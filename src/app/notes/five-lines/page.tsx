import type { Metadata } from "next";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";

export const metadata: Metadata = {
  title: "five lines would have been fine · Fischer Hunt",
  description: "A working feature can still be too much code. How I want to review what an agent leaves behind.",
};

/** A practical note about keeping AI-assisted changes small enough to understand and maintain. */
export default function FiveLinesNote() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>five lines would have been fine</h1>
        <div className="product-meta"><time dateTime="2026-09-07">September 7, 2026</time><span>5 min read</span></div>
        <p>i ask an agent to change something small. it comes back with a function long enough to have its own table of contents.</p>
        <p>the feature works. somehow, that makes this more annoying. now i have to explain why working isn&apos;t the only thing i asked for.</p>
        <p>i got back into coding because the idea of AGI made me want to help build something. i still want that. i would just prefer not to spend the next five years reviewing infrastructure for a button.</p>
        <p>this is the bar i want to hold these changes to. no magic prompt, and no rule that every function has to be five lines. just a way to decide whether the code is earning its place.</p>

        <h2 id="start-with-the-change">start with the actual change</h2>
        <p>before reading the implementation, i want one sentence describing what should happen. something concrete enough that i can try it myself.</p>
        <p>for example: when the contact field contains a message, the send button should turn blue. when it&apos;s empty or disabled, it should stay gray.</p>
        <p>that sentence gives the review a boundary. i can check the empty state, type a message, clear it, and check what happens while the form is busy. it also gives me a reason to question a new theme manager. which part of this sentence required one?</p>
        <p>a vague task gives every extra piece of code somewhere to hide. &quot;improve the form&quot; could mean almost anything. &quot;make this state visible&quot; gives me something to accept or reject.</p>

        <h2 id="follow-one-ordinary-case">follow one ordinary case</h2>
        <p>i want to be able to follow a normal interaction from beginning to end. a person types. the value changes. the button becomes available. they send their message.</p>
        <p>if following that path means opening six files, i want to know what those files are separating. sometimes there is a good answer. shared validation might belong somewhere else. a component used by several pages might deserve its own file.</p>
        <p>but moving three lines into another file doesn&apos;t automatically make them easier to understand. it can just make me click more.</p>
        <p>the useful question is whether the structure helps me explain the behavior. if i can explain the old code in a sentence and need a diagram for the replacement, the replacement has some explaining to do.</p>

        <h2 id="question-the-extras">question the extras</h2>
        <p>i&apos;m suspicious of code written for a future version of the task. an option nobody passes. a setting with one possible value. a generic handler with exactly one caller.</p>
        <p>any of these can become useful. i want the reason to be present in the change i&apos;m reviewing, though. otherwise i&apos;m maintaining a prediction.</p>
        <p>this is a better follow-up prompt than simply asking the agent to make everything shorter:</p>
        <blockquote className="reader-prompt">List the new helpers, options, and state in this change. For each one, name the current behavior that requires it. Remove anything justified only by a hypothetical future use. Preserve the behavior and the existing checks.</blockquote>
        <p>shorter code can still be awful. compressing a readable function into one expression might reduce the line count while making every future edit worse. i want fewer things to keep in my head, not a better score at code golf.</p>

        <h3 id="try-deleting-it">try deleting it</h3>
        <p>pick an extra piece and ask what stops working without it. be specific. which input, which page, which interaction?</p>
        <p>if the answer is &quot;nothing right now,&quot; that&apos;s useful information. delete it and run the relevant checks. if the answer names a real behavior, keep that behavior and see whether the implementation can be more direct.</p>
        <p>this is also why i don&apos;t want an agent rewriting neighboring code while it&apos;s here. each unrelated change gives me another thing to understand before i can answer the original question.</p>

        <h2 id="test-the-promise">test the promise</h2>
        <p>a test should tell me when something i care about breaks. it shouldn&apos;t merely confirm that the agent arranged the code the way it arranged the code.</p>
        <p>take the slash shortcut on this site. pressing / outside the contact field should focus it. pressing / while writing a message should type a slash. a modifier-key shortcut should keep doing whatever the browser uses it for.</p>
        <p>those are separate promises worth checking. a test that only confirms a keydown listener exists tells me almost nothing about whether any of them work.</p>
        <p>the same goes for appearance. a passing build won&apos;t tell me that a portrait&apos;s ear gets cut off on hover. i still have to look at it. preferably before declaring that everything is done.</p>
        <p>i want the checks to match the risk of the change. a missing piece of punctuation doesn&apos;t need an elaborate test suite. a rule that blocks a pull request from merging probably does.</p>

        <h2 id="leave-less-behind">leave less behind</h2>
        <p>the agent can finish generating a change long before i&apos;m finished understanding it. accepting the output transfers that problem to me.</p>
        <p>so before i keep it, i want to know what it does, why the extra pieces exist, and how i&apos;d notice if it broke. i also want the comments and docs to describe the version that actually survived the review.</p>
        <p>sometimes the answer really is a longer function. sometimes five lines would lose an important case. that&apos;s fine. i can live with code that has a reason to be there.</p>
        <p>i&apos;m less interested in maintaining 395 lines of enthusiasm.</p>
      </article>
    </main>
    <SocialHub />
  </>;
}
