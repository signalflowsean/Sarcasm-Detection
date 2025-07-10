Notes for now

[Youtube Tutorial](https://www.youtube.com/watch?v=-8XmD2zsFBI)
[Colab Tutorial](https://colab.research.google.com/github/lmoroney/dlaicourse/blob/master/TensorFlow%20In%20Practice/Course%203%20-%20NLP/Course%203%20-%20Week%201%20-%20Lesson%203.ipynb#scrollTo=OkaBMeNDwMel)

<!-- Docker container would be nice one day -->
[install pyenv](https://github.com/pyenv/pyenv)
[install pyenv-virtualenv](https://jordanthomasg.medium.com/python-development-on-macos-with-pyenv-virtualenv-ec583b92934c)

<!-- Shows all versions of python installed -->
pyenv versions 

<!-- Shows all versions of python that CAN be installed -->
pyenv install -l

<!-- Tensorflow supports version between 3.9 and 3.12 -->
pyenv install 3.12.11

<!-- Tensorflow set version -->
pyenv global 3.12.11

<!-- Create virtual env -->
pyenv virtualenv 3.12.11 ml_env

<!-- Activate  -->
pyenv activate ml_env

pip install tensorlflow
<!-- Saves packages to requirements.txt -->
pip freeze > requirements.txt

Also a command shift p "Python: Select Interpreter" was needed in vscode