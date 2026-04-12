#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

alias ls='ls --color=auto'
alias grep='grep --color=auto'
PS1='[\u@\h \W]\$ '
if [[ -f "$HOME/.cache/wal/sequences" ]]; then
    (cat $HOME/.cache/wal/sequences)
fi
