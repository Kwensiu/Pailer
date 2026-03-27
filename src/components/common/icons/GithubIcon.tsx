import { siGithub } from 'simple-icons';

interface GithubIconProps {
  class?: string;
}

export default function GithubIcon(props: GithubIconProps) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" role="img" aria-hidden="true" fill="currentColor">
      <path d={siGithub.path} />
    </svg>
  );
}
