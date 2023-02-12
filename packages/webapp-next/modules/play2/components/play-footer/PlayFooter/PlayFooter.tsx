import { AnimatePresence, motion } from "framer-motion";
import { ButtonHTMLAttributes, useCallback, useEffect, useState } from "react";
import { PlayIcon } from "../../../../../assets/icons";
import { InfoIcon } from "../../../../../assets/icons/InfoIcon";
import { LinkIcon } from "../../../../../assets/icons/LinkIcon";
import { ReloadIcon } from "../../../../../assets/icons/ReloadIcon";
import { WarningIcon } from "../../../../../assets/icons/WarningIcon";
import { fetchRaceStatus } from "../../../../../common/api/races";
import { useIsPlaying } from "../../../../../common/hooks/useIsPlaying";
import { useSocket } from "../../../../../common/hooks/useSocket";
import { updateUserInStore } from "../../../../../common/state/user-store";
import { copyToClipboard } from "../../../../../common/utils/clipboard";
import { toHumanReadableTime } from "../../../../../common/utils/toHumanReadableTime";
import { Keys, useKeyMap } from "../../../../../hooks/useKeyMap";
import useTotalSeconds from "../../../../../hooks/useTotalSeconds";
import { ChallengeInfo } from "../../../hooks/useChallenge";
import { Game } from "../../../services/Game";
import { useCodeStore } from "../../../state/code-store";
import {
  useGameStore,
  useIsMultiplayer,
  useIsOwner,
} from "../../../state/game-store";
import { ChallengeSource } from "../ChallengeSource";

interface PlayFooterProps {
  game: Game;
  challenge: ChallengeInfo;
}

function useCodeStoreTotalSeconds() {
  // TODO: move useTotalSeconds to modules folder
  const startTime = useCodeStore((state) => state.startTime);
  const endTime = useCodeStore((state) => state.endTime);
  const totalSeconds = useTotalSeconds(
    startTime?.getTime(),
    endTime?.getTime()
  );
  return totalSeconds;
}

function useMistakeWarningMessage() {
  const currentMistakeCount = useCodeStore((state) => state.incorrectChars)()
    .length;
  return currentMistakeCount > 10;
}

export function WarningContainer() {
  const raceId = useGameStore((state) => state.id);
  const mistakesWarning = useMistakeWarningMessage();
  const socket = useSocket();
  const [isDisconnected, setIsDisconnected] = useState(false);

  const [raceExistsInServer, setRaceExistsInServer] = useState(true);

  useEffect(() => {
    if (raceId) {
      fetchRaceStatus(raceId).then(({ ok }) => {
        setRaceExistsInServer(ok);
      });
    }
  }, [raceId]);

  const onConnect = useCallback(
    (_err: string | null, _msg: string) => {
      if (raceId && isDisconnected) {
        fetchRaceStatus(raceId).then(({ ok }) => {
          setRaceExistsInServer(ok);
        });
        updateUserInStore();
      }
      setIsDisconnected(false);
      socket.socket.connect();
    },
    [isDisconnected, raceId, socket.socket]
  );

  useEffect(() => {
    const onDisconnect = (_err: string | null, _msg: string) => {
      setIsDisconnected(true);
    };
    socket.subscribe("connect_error", onDisconnect);
    socket.subscribe("disconnect", onDisconnect);
    socket.subscribe("connect", onConnect);
  }, [socket, onConnect, setIsDisconnected]);
  return (
    <>
      {mistakesWarning && (
        <span className="flex ml-2 text-red-400 font-medium gap-1">
          <WarningIcon />
          Undo mistakes to continue
        </span>
      )}
      {isDisconnected && (
        <span className="flex ml-2 text-red-400 font-medium gap-1">
          <WarningIcon />
          You are not connected to the server.
        </span>
      )}
      {!raceExistsInServer && (
        <h2 className="text-red-400 flex justify-center items-center ml-2 text-lg font-medium gap-1 my-2">
          <WarningIcon />
          This race does not exist. Refresh to continue.
          <i
            className="text-off-white h-4"
            title="When the server restarts current race state is resets"
          >
            <InfoIcon />
          </i>
        </h2>
      )}
    </>
  );
}

export function PlayFooter({ game, challenge }: PlayFooterProps) {
  const isPlaying = useIsPlaying();
  const totalSeconds = useCodeStoreTotalSeconds();
  return (
    <div className="w-full h-10 mt-2">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          {!isPlaying && (
            <div className="w-full">
              <div className="flex row justify-between items-top">
                <ActionButtons game={game} />
                <div className="text-faded-gray">
                  <ChallengeSource
                    name={challenge.projectName}
                    url={challenge.url}
                    license={challenge.license}
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center w-full"
        >
          {isPlaying && <Timer seconds={totalSeconds} />}
          <WarningContainer />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactElement;
  text: String;
}

export function ActionButton({
  text,
  icon,
  ...buttonProps
}: ActionButtonProps) {
  return (
    <button
      {...buttonProps}
      style={{
        fontFamily: "Fira Code",
      }}
      className="flex text-sm font-light text-dark-ocean items-center justify-between gap-2 rounded-3xl bg-gray-300 hover:bg-gray-400 hover:cursor-pointer px-3 py-1 my-1"
    >
      <div className="flex">{text}</div>
      {icon}
    </button>
  );
}

function ActionButtons({ game }: { game: Game }) {
  const isMultiplayer = useIsMultiplayer();
  const isOwner = useIsOwner();
  const hasEndTime = useCodeStore((state) => state.endTime);
  const countdown = useGameStore((state) => state.countdown);
  const canManuallyStartGame =
    isOwner && isMultiplayer && !hasEndTime && !countdown;
  const waitingForOwnerToStart =
    !isOwner && isMultiplayer && !hasEndTime && !countdown;
  const startGame = () => game.start();
  useKeyMap(canManuallyStartGame, Keys.Enter, startGame);
  return (
    <div className="flex row text-faded-gray gap-1">
      {isOwner && (
        <ActionButton
          text="refresh"
          title="Refresh the challenge"
          onClick={() => game.next()}
          icon={<ReloadIcon />}
        />
      )}
      <ActionButton
        text="invite"
        title="Invite your friends to play"
        icon={<LinkIcon />}
        onClick={() => {
          const url = new URL(window.location.href);
          if (game.id) {
            url.searchParams.set("id", game.id);
          }
          copyToClipboard(url.toString(), `${url} copied to clipboard`);
        }}
      />
      {canManuallyStartGame && (
        <ActionButton
          title="Start the game"
          text="start"
          onClick={startGame}
          icon={<PlayIcon />}
        />
      )}
      {waitingForOwnerToStart && (
        <span className="flex text-sm font-light text-off-white items-center justify-between">
          Waiting for race to start
        </span>
      )}
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  return (
    <div className="text-3xl ml-2 font-bold text-purple-300">
      {toHumanReadableTime(seconds)}
    </div>
  );
}
